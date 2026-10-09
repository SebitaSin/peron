/** Utilidades de servidor: rate limit en memoria (best-effort por instancia) y logs estructurados sin contenido de conversaciones. */

const buckets = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
  }
  return { ok: true, retryAfter: 0 };
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  return (xf?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

/** Nunca registra mensajes del usuario ni respuestas: sólo metadatos operativos. */
export function logEvent(kind: string, meta: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ t: new Date().toISOString(), kind, ...meta });
  if (kind.includes("error")) console.error(line);
  else console.log(line);
}
