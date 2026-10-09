import type { MemoryPatch } from "./state";
import { cleanStr, toSpokenText } from "./text";

export type BasisKind = "DOCUMENTADO" | "INFERENCIA" | "USUARIO";
export interface RawBasis {
  kind: BasisKind;
  text: string;
  source_ids: string[];
}
export const EMOTIONS = ["sereno", "calido", "firme", "ironico", "grave", "emocionado", "curioso"] as const;
export type Emotion = (typeof EMOTIONS)[number];
export interface ParsedOutput {
  reply: string;
  emotion: Emotion;
  patch: MemoryPatch;
  basis: RawBasis[];
  wellFormed: boolean;
}

function tag(raw: string, name: string): string | null {
  const m = raw.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1].trim() : null;
}

function json(s: string | null): unknown {
  if (!s) return null;
  const cleaned = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export function parseModelOutput(raw: string): ParsedOutput {
  const replyTag = tag(raw, "reply");
  const wellFormed = replyTag !== null;
  const fallback = raw.replace(/<emo>[\s\S]*?<\/emo>/gi, "").replace(/<memory>[\s\S]*?<\/memory>/gi, "").replace(/<basis>[\s\S]*?<\/basis>/gi, "").replace(/<\/?reply>/gi, "");
  const reply = toSpokenText(replyTag ?? fallback);
  const emoRaw = (tag(raw, "emo") ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  const emotion: Emotion = (EMOTIONS as readonly string[]).includes(emoRaw) ? (emoRaw as Emotion) : "sereno";

  const mem = json(tag(raw, "memory"));
  const patch: MemoryPatch = mem && typeof mem === "object" && !Array.isArray(mem) ? (mem as MemoryPatch) : {};

  const b = json(tag(raw, "basis"));
  const basis: RawBasis[] = [];
  if (Array.isArray(b)) {
    for (const item of b.slice(0, 8)) {
      const o = (item ?? {}) as Record<string, unknown>;
      const kind = o.kind;
      if (kind !== "DOCUMENTADO" && kind !== "INFERENCIA" && kind !== "USUARIO") continue;
      const text = cleanStr(o.text, 280);
      if (!text) continue;
      const ids = Array.isArray(o.source_ids) ? o.source_ids.filter((x): x is string => typeof x === "string").slice(0, 4) : [];
      basis.push({ kind, text, source_ids: ids });
    }
  }
  return { reply, emotion, patch, basis, wellFormed };
}
