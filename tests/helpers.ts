import type { LLMProvider, LLMRequest, LLMResult } from "@/lib/llm/provider";

/** Proveedor guionado SÓLO para tests unitarios. Nunca se usa en la app. */
export function scripted(outputs: string[]): LLMProvider & { calls: LLMRequest[] } {
  const calls: LLMRequest[] = [];
  let i = 0;
  return {
    name: "scripted-test",
    calls,
    async complete(req: LLMRequest): Promise<LLMResult> {
      calls.push(req);
      const text = outputs[Math.min(i, outputs.length - 1)];
      i++;
      return { text, model: "test-model" };
    },
  };
}

export const out = (reply: string, memory: object = {}, basis: object[] = []) =>
  `<reply>${reply}</reply>\n<memory>${JSON.stringify(memory)}</memory>\n<basis>${JSON.stringify(basis)}</basis>`;
