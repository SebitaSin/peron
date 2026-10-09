import { clientIp, logEvent, rateLimit } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2_000_000; // ~60 s de WAV 16 kHz mono; el cliente corta a 15 s
/** Frases que los modelos de transcripción inventan ante silencio o ruido. */
const PHANTOM = /^(gracias por ver|gracias por vernos|subt[ií]tulos?|suscr[ií]b|amara\.org|¡?hasta la pr[oó]xima|no olvides suscribirte|\.+|you|thank you)/i;

async function transcribe(key: string, model: string, file: Blob): Promise<Response> {
  const body = new FormData();
  body.append("file", file, "voz.wav");
  body.append("model", model);
  body.append("language", "es");
  body.append("response_format", "json");
  body.append("temperature", "0");
  body.append("prompt", "Conversación en español rioplatense (Argentina) con un interlocutor; puede mencionar Perón, Evita, peronismo, trabajadores.");
  return fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body,
    signal: AbortSignal.timeout(20_000),
  });
}

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });
  if (!rateLimit(`stt:${clientIp(req)}`, 240, 10 * 60_000).ok) return Response.json({ error: "rate_limited" }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const f = form?.get("audio");
  if (!(f instanceof Blob) || f.size < 2000) return Response.json({ error: "bad_audio" }, { status: 400 });
  if (f.size > MAX_BYTES) return Response.json({ error: "too_large" }, { status: 413 });

  try {
    let r = await transcribe(key, process.env.STT_MODEL ?? "gpt-4o-mini-transcribe", f);
    if (!r.ok && !process.env.STT_MODEL && [400, 403, 404].includes(r.status)) r = await transcribe(key, "whisper-1", f);
    if (!r.ok) {
      logEvent("stt_error", { status: r.status });
      return Response.json({ error: "upstream" }, { status: 502 });
    }
    const j = (await r.json()) as { text?: string };
    let text = (j.text ?? "").replace(/\s+/g, " ").trim();
    if (PHANTOM.test(text) || !/[\p{L}\p{N}]/u.test(text)) text = "";
    return Response.json({ text }, { headers: { "cache-control": "no-store" } });
  } catch {
    logEvent("stt_error", { status: 0 });
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
