import { fetchWithTimeout, normalizeMessages, ProviderError, withRetry, type LLMProvider, type LLMRequest, type LLMResult } from "./provider";

export function anthropicProvider(apiKey: string, model: string): LLMProvider {
  return {
    name: "anthropic",
    async complete(req: LLMRequest): Promise<LLMResult> {
      const body = {
        model,
        max_tokens: req.maxTokens,
        temperature: req.temperature,
        system: req.system.map((b) => ({
          type: "text",
          text: b.text,
          ...(b.cache ? { cache_control: { type: "ephemeral" } } : {}),
        })),
        messages: normalizeMessages(req.messages),
      };
      return withRetry(async () => {
        const res = await fetchWithTimeout(`${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new ProviderError(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);
        const j = (await res.json()) as {
          content?: { type: string; text?: string }[];
          model?: string;
          usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number };
        };
        const text = (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
        return {
          text,
          model: j.model ?? model,
          usage: { input: j.usage?.input_tokens, output: j.usage?.output_tokens, cache_read: j.usage?.cache_read_input_tokens },
        };
      });
    },
  };
}
