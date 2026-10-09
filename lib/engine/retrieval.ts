import type { CharacterPack, KnowledgePassage } from "@/characters/types";
import { normalize } from "./text";

const STOP = new Set(
  "que como para por con una uno unos unas los las del las pero mas muy sus sin sobre entre esta este esto eso esa ese era fue son ser hay hoy usted general digame dime cuenteme cuente dice dijo quiero puede tiene tengo cual cuales donde cuando porque pues bien asi todo toda todos nada algo".split(" "),
);

export function tokens(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

export interface Retrieved {
  passage: KnowledgePassage;
  score: number;
}

/** Recuperación léxica barata (sin embeddings). Devuelve [] en charla cotidiana. Filtra por fecha activa. */
export function retrieve(query: string, pack: CharacterPack, activeDate: string, limit = 3): Retrieved[] {
  const q = [...new Set(tokens(query))];
  if (!q.length) return [];
  const scored: Retrieved[] = [];
  for (const p of pack.knowledge) {
    if (p.as_of > activeDate) continue;
    const kw = new Set(p.keywords.flatMap((k) => tokens(k)));
    const body = new Set(tokens(p.text + " " + p.topics.join(" ")));
    let score = 0;
    let kwHits = 0;
    for (const t of q) {
      if (kw.has(t)) {
        score += 3;
        kwHits++;
      } else if (body.has(t)) score += 1;
    }
    if (kwHits >= 1 && score >= 3) scored.push({ passage: p, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
