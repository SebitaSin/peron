import type { CharacterPack } from "@/characters/types";
import { cleanList, cleanStr, slug } from "./text";

export const MIN_DATE = "1943-01-01";
export const MAX_DATE = "1974-06-30";

export interface KnownFuture {
  id: string;
  label: string;
  turn: number;
  claim: string;
}
export interface LearnedTech {
  id: string;
  label: string;
  gist: string;
  turn: number;
}

/** Memoria independiente de UNA conversación. Viaja con el cliente y se valida en el servidor en cada turno. */
export interface SessionState {
  v: 1;
  session_id: string;
  character: string;
  active_date: string;
  turn: number;
  user: { name?: string; from_year?: number; profession?: string; origin?: string };
  /** 1 desconocido · 2 interlocutor interesante · 3 confianza · 4 intimidad */
  trust: number;
  /** 0 sin tema · 1 escéptico · 2 parcialmente convencido · 3 convencido */
  future_credence: number;
  known_future: KnownFuture[];
  tech_seen: string[];
  tech_learned: LearnedTech[];
  years_seen: number[];
  facts: string[];
  political: string[];
  personal: string[];
  jokes: string[];
  pending: string[];
  open_thread: string;
  summary: string;
}

export interface MemoryPatch {
  user_name?: unknown;
  user_from_year?: unknown;
  user_profession?: unknown;
  user_origin?: unknown;
  facts_add?: unknown;
  political_add?: unknown;
  personal_add?: unknown;
  jokes_add?: unknown;
  tech_learned_add?: unknown;
  pending?: unknown;
  open_thread?: unknown;
  trust?: unknown;
  future_credence?: unknown;
  summary?: unknown;
}

export function newSessionId(): string {
  const c = globalThis.crypto;
  return c && "randomUUID" in c ? c.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function newState(pack: CharacterPack, id?: string): SessionState {
  return {
    v: 1,
    session_id: id ?? newSessionId(),
    character: pack.slug,
    active_date: pack.profile.start_date,
    turn: 0,
    user: {},
    trust: 1,
    future_credence: 0,
    known_future: [],
    tech_seen: [],
    tech_learned: [],
    years_seen: [],
    facts: [],
    political: [],
    personal: [],
    jokes: [],
    pending: [],
    open_thread: "",
    summary: "",
  };
}

const int = (v: unknown, lo: number, hi: number, dflt: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : dflt;

export function isValidDate(d: unknown): d is string {
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  if (Number.isNaN(Date.parse(d))) return false;
  return d >= MIN_DATE && d <= MAX_DATE;
}

/** Nunca confía en el cliente: reconstruye el estado campo por campo con topes de tamaño. */
export function sanitizeState(raw: unknown, pack: CharacterPack): SessionState {
  const base = newState(pack);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const eventById = new Map(pack.timeline.map((e) => [e.id, e]));
  const techIds = new Set(pack.temporal_gates.anachronisms.map((t) => t.id));
  const u = (r.user && typeof r.user === "object" ? r.user : {}) as Record<string, unknown>;

  const known_future = (Array.isArray(r.known_future) ? r.known_future : [])
    .map((k) => {
      const o = (k ?? {}) as Record<string, unknown>;
      const ev = typeof o.id === "string" ? eventById.get(o.id) : undefined;
      if (!ev) return null;
      return { id: ev.id, label: ev.label, turn: int(o.turn, 0, 10000, 0), claim: cleanStr(o.claim, 240) };
    })
    .filter((x): x is KnownFuture => x !== null)
    .slice(0, 60);

  const tech_learned = (Array.isArray(r.tech_learned) ? r.tech_learned : [])
    .map((k) => {
      const o = (k ?? {}) as Record<string, unknown>;
      const label = cleanStr(o.label, 60);
      if (!label) return null;
      return { id: cleanStr(o.id, 40) || slug(label), label, gist: cleanStr(o.gist, 220), turn: int(o.turn, 0, 10000, 0) };
    })
    .filter((x): x is LearnedTech => x !== null)
    .slice(0, 30);

  return {
    v: 1,
    session_id: cleanStr(r.session_id, 80) || base.session_id,
    character: pack.slug,
    active_date: isValidDate(r.active_date) ? r.active_date : base.active_date,
    turn: int(r.turn, 0, 10000, 0),
    user: {
      name: cleanStr(u.name, 60) || undefined,
      from_year: typeof u.from_year === "number" ? int(u.from_year, 1900, 2200, 0) || undefined : undefined,
      profession: cleanStr(u.profession, 80) || undefined,
      origin: cleanStr(u.origin, 80) || undefined,
    },
    trust: int(r.trust, 1, 4, 1),
    future_credence: int(r.future_credence, 0, 3, 0),
    known_future,
    tech_seen: (Array.isArray(r.tech_seen) ? r.tech_seen : []).filter((x): x is string => typeof x === "string" && techIds.has(x)).slice(0, 60),
    tech_learned,
    years_seen: (Array.isArray(r.years_seen) ? r.years_seen : [])
      .map((y) => int(y, 0, 3000, 0))
      .filter((y) => y >= 1500)
      .slice(0, 40),
    facts: cleanList(r.facts, 30, 200),
    political: cleanList(r.political, 20, 200),
    personal: cleanList(r.personal, 20, 200),
    jokes: cleanList(r.jokes, 10, 160),
    pending: cleanList(r.pending, 8, 200),
    open_thread: cleanStr(r.open_thread, 400),
    summary: cleanStr(r.summary, 900),
  };
}

function pushCapped(list: string[], add: string[], max: number): string[] {
  const out = [...list];
  for (const a of add) if (!out.includes(a)) out.push(a);
  return out.slice(-max);
}

/** Aplica la actualización de memoria que propone el modelo, con reglas deterministas encima. */
export function applyPatch(prev: SessionState, patch: MemoryPatch, pack: CharacterPack): SessionState {
  const s: SessionState = structuredClone(prev);
  const name = cleanStr(patch.user_name, 60);
  if (name) s.user.name = name;
  if (typeof patch.user_from_year === "number") {
    const y = int(patch.user_from_year, 1900, 2200, 0);
    if (y) s.user.from_year = y;
  }
  const prof = cleanStr(patch.user_profession, 80);
  if (prof) s.user.profession = prof;
  const origin = cleanStr(patch.user_origin, 80);
  if (origin) s.user.origin = origin;

  s.facts = pushCapped(s.facts, cleanList(patch.facts_add, 6, 200), 30);
  s.political = pushCapped(s.political, cleanList(patch.political_add, 6, 200), 20);
  s.personal = pushCapped(s.personal, cleanList(patch.personal_add, 6, 200), 20);
  s.jokes = pushCapped(s.jokes, cleanList(patch.jokes_add, 3, 160), 10);
  if (Array.isArray(patch.pending)) s.pending = cleanList(patch.pending, 8, 200);
  if (typeof patch.open_thread === "string" || patch.open_thread === null) s.open_thread = cleanStr(patch.open_thread, 400);
  const summary = cleanStr(patch.summary, 900);
  if (summary) s.summary = summary;

  if (Array.isArray(patch.tech_learned_add)) {
    for (const raw of patch.tech_learned_add.slice(0, 4)) {
      const o = (raw ?? {}) as Record<string, unknown>;
      const label = cleanStr(o.label, 60);
      if (!label) continue;
      const lower = label.toLowerCase();
      const concept = pack.temporal_gates.anachronisms.find(
        (c) => c.label.toLowerCase() === lower || c.terms.some((t) => new RegExp(t.src, t.flags ?? "i").test(label)),
      );
      const id = concept?.id ?? (cleanStr(o.id, 40) || slug(label));
      const gist = cleanStr(o.gist, 220);
      const i = s.tech_learned.findIndex((x) => x.id === id);
      if (i >= 0) s.tech_learned[i] = { ...s.tech_learned[i], gist: gist || s.tech_learned[i].gist };
      else s.tech_learned.push({ id, label: concept?.label ?? label, gist, turn: s.turn });
    }
    s.tech_learned = s.tech_learned.slice(-30);
  }

  if (typeof patch.trust === "number") {
    const t = int(patch.trust, 1, 4, s.trust);
    s.trust = Math.min(4, Math.max(1, Math.max(s.trust - 1, Math.min(s.trust + 1, t))));
  }
  if (typeof patch.future_credence === "number") {
    const c = int(patch.future_credence, 0, 3, s.future_credence);
    // La incredulidad inicial no vuelve: la credibilidad sólo sube (+1 por turno como máximo).
    s.future_credence = Math.max(s.future_credence, Math.min(s.future_credence + 1, c));
  }
  return s;
}
