import { anthropicProvider } from "./anthropic";
import { openaiProvider } from "./openai";
import { ProviderNotConfigured, type LLMProvider } from "./provider";

/** Selecciona proveedor por variables de entorno (sólo servidor). Sin clave => ProviderNotConfigured (nunca respuestas simuladas). */
export function getProvider(): LLMProvider {
  const want = (process.env.LLM_PROVIDER ?? "").toLowerCase();
  const aKey = process.env.ANTHROPIC_API_KEY;
  const oKey = process.env.OPENAI_API_KEY;
  const model = process.env.LLM_MODEL;

  if ((want === "openai" || (!want && !aKey)) && oKey) {
    return openaiProvider(oKey, model);
  }
  if (aKey && want !== "openai") return anthropicProvider(aKey, model || "claude-sonnet-5-5");
  throw new ProviderNotConfigured();
}

export function providerConfigured(): boolean {
  try {
    getProvider();
    return true;
  } catch {
    return false;
  }
}
