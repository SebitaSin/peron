import { fetchWithTimeout, normalizeMessages, ProviderError, withRetry, type LLMProvider, type LLMRequest, type LLMResult } from "./provider";

export function openaiProvider(apiKey: string, model: string): LLMProvider {
  return {
    name: "openai",
    async complete(req: LLMRequest): Promise<LLMResult> {
      const body = {
        model,
        max_completion_tokens: req.maxTokens,
        temperature: req.temperature,
        messages: [
          { role: "system", content: req.system.map((b) => b.text).join("\n\n") },
          ...normalizeMessages(req.messages),
        ],
      };
      return withRetry(async () => {
        const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new ProviderError(`openai ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);
        const j = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
          model?: string;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        return {
          text: j.choices?.[0]?.message?.content ?? "",
          model: j.model ?? model,
          usage: { input: j.usage?.prompt_tokens, output: j.usage?.completion_tokens },
        };
      });
    },
  };
}
