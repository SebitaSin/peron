import type { CharacterPack, TechConcept, Term, TimelineEvent } from "@/characters/types";
import { MAX_DATE, MIN_DATE, type SessionState } from "./state";

const cache = new Map<string, RegExp>();
export function rx(t: Term): RegExp {
  const key = `${t.flags ?? "i"}/${t.src}`;
  let r = cache.get(key);
  if (!r) {
    r = new RegExp(t.src, t.flags ?? "i");
    cache.set(key, r);
  }
  return r;
}
export const matchesAny = (text: string, terms: Term[] | undefined): boolean => !!terms && terms.some((t) => rx(t).test(text));

export const futureEvents = (pack: CharacterPack, activeDate: string): TimelineEvent[] =>
  pack.timeline.filter((e) => e.date > activeDate);

export const pastEvents = (pack: CharacterPack, activeDate: string): TimelineEvent[] =>
  pack.timeline.filter((e) => e.date <= activeDate);

/** Eventos futuros que el interlocutor nombra o afirma en este mensaje. */
export function detectRevealed(text: string, pack: CharacterPack, activeDate: string): TimelineEvent[] {
  return futureEvents(pack, activeDate).filter((e) => matchesAny(text, e.terms) || matchesAny(text, e.user_terms));
}

export function detectTech(text: string, pack: CharacterPack): TechConcept[] {
  return pack.temporal_gates.anachronisms.filter((t) => matchesAny(text, t.terms));
}

export function detectYears(text: string): number[] {
  const out = new Set<number>();
  for (const m of text.matchAll(/\b(1[5-9]\d\d|2[01]\d\d)\b/g)) out.add(Number(m[1]));
  return [...out];
}

export interface Leaks {
  events: TimelineEvent[];
  tech: TechConcept[];
  years: number[];
  any: boolean;
}

/** Compuerta de conocimiento temporal: no depende del prompt, se aplica sobre la respuesta generada. */
export function detectLeaks(reply: string, pack: CharacterPack, state: SessionState): Leaks {
  const known = new Set(state.known_future.map((k) => k.id));
  const events = futureEvents(pack, state.active_date).filter((e) => !known.has(e.id) && matchesAny(reply, e.terms));
  const tech = pack.temporal_gates.anachronisms.filter((t) => !state.tech_seen.includes(t.id) && matchesAny(reply, t.terms));
  const limit = Number(state.active_date.slice(0, 4)) + 2;
  const years = detectYears(reply).filter((y) => y >= limit && !state.years_seen.includes(y));
  return { events, tech, years, any: events.length + tech.length + years.length > 0 };
}

const MONTHS: Record<string, string> = {
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
};

/**
 * Cambio explícito de fecha ("Estamos en marzo de 1953", "Situémonos en 1955").
 * Es deliberadamente conservador: "en 1955 lo van a derrocar" NO cambia la fecha activa.
 */
export function parseActiveDateDirective(text: string): string | null {
  const m = text.match(
    /(?:\bhoy es\b|\bestamos (?:en|a)\b|\bsitu[eé]monos en\b|\bsit[uú]ese en\b|\bubiqu[eé]monos en\b|\bviajemos a\b|\bvolvamos a\b|\btrasl[aá]dese a\b|\bsupongamos que estamos en\b)\s+(?:(?:el|la)\s+)?(?:(\d{1,2})\s+de\s+)?(?:(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?)?(19\d{2})\b/i,
  );
  if (!m) return null;
  const year = m[3];
  const month = m[2] ? MONTHS[m[2].toLowerCase()] : "01";
  const day = m[1] ? m[1].padStart(2, "0") : "01";
  const iso = `${year}-${month}-${day}`;
  if (Number.isNaN(Date.parse(iso))) return null;
  return iso >= MIN_DATE && iso <= MAX_DATE ? iso : null;
}
