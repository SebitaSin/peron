import { cleanStr } from "@/lib/engine/text";
import { clientIp, logEvent, rateLimit } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Beacon de errores del cliente. No acepta ni registra contenido de conversaciones. */
export async function POST(req: Request) {
  if (!rateLimit(`log:${clientIp(req)}`, 20, 10 * 60_000).ok) return new Response(null, { status: 204 });
  try {
    const raw = await req.text();
    if (raw.length > 4000) return new Response(null, { status: 204 });
    const b = JSON.parse(raw) as Record<string, unknown>;
    logEvent("client_error", {
      where: cleanStr(b.where, 40),
      msg: cleanStr(b.msg, 200),
      ua: cleanStr(req.headers.get("user-agent"), 120),
    });
  } catch {
    /* ignorar */
  }
  return new Response(null, { status: 204 });
}
