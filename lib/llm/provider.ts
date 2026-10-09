export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}
export interface SystemBlock {
  text: string;
  /** Bloque estable: candidato a prompt caching. */
  cache?: boolean;
}
export interface LLMRequest {
  system: SystemBlock[];
  messages: LLMMessage[];
  maxTokens: number;
  temperature: number;
}
export interface LLMResult {
  text: string;
  model: string;
  usage?: { input?: number; output?: number; cache_read?: number };
}
export interface LLMProvider {
  name: string;
  complete(req: LLMRequest): Promise<LLMResult>;
}

export class ProviderNotConfigured extends Error {
  constructor(msg = "LLM provider not configured") {
    super(msg);
    this.name = "ProviderNotConfigured";
  }
}
export class ProviderError extends Error {
  status: number;
  constructor(msg: string, status: number) {
    super(msg);
    this.name = "ProviderError";
    this.status = status;
  }
}

/** Las APIs exigen alternancia estricta y primer turno de usuario. */
export function normalizeMessages(msgs: LLMMessage[]): LLMMessage[] {
  const out: LLMMessage[] = [];
  for (const m of msgs) {
    if (!m.content.trim()) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += "\n" + m.content;
    else out.push({ ...m });
  }
  if (!out.length || out[0].role !== "user") out.unshift({ role: "user", content: "[El interlocutor entra al despacho y toma asiento.]" });
  return out;
}

export async function fetchWithTimeout(url: string, init: RequestInit, ms = 45_000): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ProviderError && [429, 500, 502, 503, 529].includes(e.status)) {
      await new Promise((r) => setTimeout(r, 900));
      return fn();
    }
    throw e;
  }
}
