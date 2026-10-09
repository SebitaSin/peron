export function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

/** Limpia texto que entrará al prompt: sin control chars, sin ángulos (evita inyectar etiquetas), espacios colapsados. */
export function cleanStr(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  const t = s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  return clip(t, max);
}

export function cleanList(a: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(a)) return [];
  const out: string[] = [];
  for (const x of a) {
    const s = cleanStr(x, maxLen);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function countSentences(s: string): number {
  const parts = s
    .split(/(?<=[.!?…])\s+/)
    .map((x) => x.trim())
    .filter((x) => /[\p{L}\p{N}]/u.test(x));
  return Math.max(parts.length, s.trim() ? 1 : 0);
}

/** La salida se escucha: fuera markdown, acotaciones entre asteriscos y viñetas. */
export function toSpokenText(s: string): string {
  return s
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*[^*\n]{1,80}\*/g, " ")
    .replace(/[*_`#]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/^["“]+|["”]+$/g, "")
    .trim();
}

export function slug(s: string): string {
  return normalize(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}
