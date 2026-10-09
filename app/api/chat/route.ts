import { getCharacter, isServable } from "@/characters";
import { sanitizeState } from "@/lib/engine/state";
import { cleanStr } from "@/lib/engine/text";
import { runTurn } from "@/lib/engine/turn";
import { getProvider } from "@/lib/llm";
import { ProviderError, ProviderNotConfigured, type LLMMessage } from "@/lib/llm/provider";
import { clientIp, logEvent, rateLimit } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_BODY = 80_000;
const MAX_MESSAGE = 1200;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });

export async function POST(req: Request) {
  const started = Date.now();
  const ip = clientIp(req);
  const rl = rateLimit(`chat:${ip}`, 30, 10 * 60_000);
  if (!rl.ok) return json({ error: "rate_limited" }, 429, { "retry-after": String(rl.retryAfter) });

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY) return json({ error: "too_large" }, 413);

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return json({ error: "too_large" }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const slug = typeof body.character === "string" ? body.character : "";
  const pack = getCharacter(slug);
  if (!pack || !isServable(slug)) return json({ error: "not_found" }, 404);

  const message = cleanStr(body.message, MAX_MESSAGE);
  if (!message) return json({ error: "empty_message" }, 400);

  const history: LLMMessage[] = (Array.isArray(body.history) ? body.history : [])
    .slice(-12)
    .map((m) => {
      const o = (m ?? {}) as Record<string, unknown>;
      const role = o.role === "assistant" ? ("assistant" as const) : ("user" as const);
      return { role, content: cleanStr(o.content, 1600) };
    })
    .filter((m) => m.content);

  const state = sanitizeState(body.state, pack);

  let provider;
  try {
    provider = getProvider();
  } catch (e) {
    if (e instanceof ProviderNotConfigured) {
      logEvent("chat_not_configured");
      return json({ error: "not_configured" }, 503);
    }
    throw e;
  }

  try {
    const r = await runTurn({ pack, state, history, message, interrupted: body.interrupted === true, provider });
    logEvent("chat_turn", {
      character: slug,
      turn: r.state.turn,
      ms: Date.now() - started,
      regenerated: r.meta.regenerated,
      fallback: r.meta.fallback,
      retrieved: r.meta.retrieved.length,
      model: r.meta.model,
      in: r.meta.usage?.input,
      out: r.meta.usage?.output,
      cache_read: r.meta.usage?.cache_read,
    });
    return json({ reply: r.reply, state: r.state, basis: r.basis });
  } catch (e) {
    const status = e instanceof ProviderError ? e.status : 0;
    logEvent("chat_error", { character: slug, status, name: e instanceof Error ? e.name : "unknown" });
    return json({ error: "upstream" }, 502);
  }
}
