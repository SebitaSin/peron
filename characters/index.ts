import { peron } from "./peron";
import peronReport from "./peron/evaluation_report.json";
import type { CharacterPack, CharacterStatus, EvaluationReport, PublicCharacter } from "./types";

/** Registro de personajes. Agregar uno nuevo = crear /characters/<slug>/ y registrarlo acá. */
const PACKS: Record<string, CharacterPack> = { [peron.slug]: peron };
const REPORTS: Record<string, EvaluationReport> = { [peron.slug]: peronReport as EvaluationReport };

export const listSlugs = (): string[] => Object.keys(PACKS);
export const getCharacter = (slug: string): CharacterPack | undefined => PACKS[slug];
export const getReport = (slug: string): EvaluationReport | undefined => REPORTS[slug];

/** Un personaje sólo es "published" si pasó la evaluación automática y tiene la firma humana. */
export function statusOf(slug: string): CharacterStatus {
  const r = REPORTS[slug];
  return r && r.automatic_pass && r.manual_signoff ? "published" : "draft";
}

/** Disponible para visitantes: publicado, o borrador habilitado explícitamente para pruebas internas. */
export function isServable(slug: string): boolean {
  return statusOf(slug) === "published" || process.env.ALLOW_DRAFT_CHARACTERS === "1";
}

export function toPublic(pack: CharacterPack): PublicCharacter {
  return { slug: pack.slug, status: statusOf(pack.slug), profile: pack.profile };
}
