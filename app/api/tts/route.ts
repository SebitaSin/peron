import { clientIp, logEvent, rateLimit } from "@/lib/server";
import { EMOTIONS, type Emotion } from "@/lib/engine/output";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cómo se dice cada estado de ánimo. Voz sintética genérica: no imita ni clona la voz de ninguna persona real. */
const STYLE: Record<Emotion, string> = {
  sereno: "Calmo, pausado, seguro; cercano, como quien conversa en privado.",
  calido: "Cálido y afable, con una sonrisa en la voz; cercano y paternal sin exagerar.",
  firme: "Firme y claro, con autoridad tranquila; énfasis en las ideas clave, sin gritar.",
  ironico: "Con ironía seca y picardía; una media sonrisa, ritmo ágil.",
  grave: "Grave y pausado; la voz baja, pesada, con gravedad.",
  emocionado: "Emocionado y vehemente, con energía contenida; el ritmo se acelera y se afloja.",
  curioso: "Curioso y atento, con interés genuino; entonación que sube al preguntar.",
};

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });
  if (!rateLimit(`tts:${clientIp(req)}`, 120, 10 * 60_000).ok) return Response.json({ error: "rate_limited" }, { status: 429 });

  const body = (await req.json().catch(() => null)) as { text?: unknown; emotion?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.replace(/[<>\u0000-\u001f]/g, " ").trim().slice(0, 900) : "";
  if (!text) return Response.json({ error: "empty" }, { status: 400 });
  const emotion = (EMOTIONS as readonly string[]).includes(String(body?.emotion)) ? (body!.emotion as Emotion) : "sereno";

  const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com";
  try {
    const r = await fetch(`${base}/v1/audio/speech`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.TTS_MODEL ?? "gpt-4o-mini-tts",
        voice: process.env.TTS_VOICE ?? "ash",
        input: text,
        instructions: `Acento argentino rioplatense criollo de mediados del siglo XX, hombre de unos 55 años, ex militar y conductor político: voz de barítono sobria, pausada y didáctica, con el mismo timbre, acento y velocidad constantes de principio a fin (ritmo lento y parejo, unas 120 palabras por minuto), que explica con paciencia, con pausas cortas entre ideas y una cadencia de conversación en privado, nunca de locutor ni de caricatura; se escucha una sonrisa leve cuando se ríe de sí mismo. ${STYLE[emotion]}`,
        response_format: "mp3",
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok || !r.body) {
      logEvent("tts_error", { status: r.status });
      return Response.json({ error: "upstream" }, { status: 502 });
    }
    return new Response(r.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
  } catch {
    logEvent("tts_error", { status: 0 });
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
