import { listSlugs, statusOf } from "@/characters";
import { providerConfigured } from "@/lib/llm";

export const dynamic = "force-dynamic";

/** Estado operativo. No expone claves ni su valor, sólo si existe configuración. */
export function GET() {
  return Response.json(
    {
      ok: true,
      llm_configured: providerConfigured(),
      tts_configured: !!(process.env.OPENAI_API_KEY || (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID)),
      tts_provider: process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID ? "elevenlabs" : process.env.OPENAI_API_KEY ? "openai" : null,
      allow_draft: process.env.ALLOW_DRAFT_CHARACTERS === "1",
      characters: listSlugs().map((s) => ({ slug: s, status: statusOf(s) })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
