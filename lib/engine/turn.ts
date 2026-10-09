import type { CharacterPack, SourceRecord } from "@/characters/types";
import type { LLMMessage, LLMProvider } from "@/lib/llm/provider";
import { buildContext, type TurnSignals } from "./context";
import { detectLeaks, detectRevealed, detectTech, detectYears, parseActiveDateDirective, type Leaks } from "./gate";
import { parseModelOutput, type BasisKind } from "./output";
import { retrieve } from "./retrieval";
import { applyPatch, type SessionState } from "./state";
import { clip } from "./text";

export interface BasisItem {
  kind: BasisKind;
  text: string;
  sources: Pick<SourceRecord, "source_id" | "title" | "author" | "date" | "reliability" | "url_checked">[];
}

export interface TurnResult {
  reply: string;
  state: SessionState;
  basis: BasisItem[];
  meta: { regenerated: boolean; fallback: boolean; retrieved: string[]; model: string; usage?: { input?: number; output?: number; cache_read?: number } };
}

const SAFE_FALLBACK = "Espere... perdí el hilo un momento. Dígame de nuevo qué quería saber.";

function describeLeaks(l: Leaks): string {
  const parts = [...l.events.map((e) => e.label), ...l.tech.map((t) => t.label), ...l.years.map(String)];
  return parts.join("; ");
}

export async function runTurn(args: {
  pack: CharacterPack;
  state: SessionState;
  history: LLMMessage[];
  message: string;
  interrupted?: boolean;
  provider: LLMProvider;
}): Promise<TurnResult> {
  const { pack, history, message, provider } = args;
  const s: SessionState = structuredClone(args.state);
  s.turn += 1;

  // 1. Fecha activa (cambio explícito) — antes de detectar revelaciones, porque cambia qué es "futuro".
  const newDate = parseActiveDateDirective(message);
  const dateChanged = !!newDate && newDate !== s.active_date;
  if (newDate) s.active_date = newDate;

  // 2. Compuerta determinista sobre el mensaje del usuario.
  const revealedNow = detectRevealed(message, pack, s.active_date).filter((e) => !s.known_future.some((k) => k.id === e.id));
  for (const e of revealedNow) s.known_future.push({ id: e.id, label: e.label, turn: s.turn, claim: clip(message.replace(/\s+/g, " "), 200) });
  const techNow = detectTech(message, pack).filter((t) => !s.tech_seen.includes(t.id));
  for (const t of techNow) s.tech_seen.push(t.id);
  for (const y of detectYears(message)) if (!s.years_seen.includes(y)) s.years_seen.push(y);
  s.years_seen = s.years_seen.slice(-40);
  // Un evento que quedó en el pasado por un cambio de fecha ya no es "revelado".
  s.known_future = s.known_future.filter((k) => pack.timeline.find((e) => e.id === k.id && e.date > s.active_date));

  // 3. Recuperación documental sólo cuando hay coincidencia clara.
  const evidence = retrieve(message, pack, s.active_date);

  const signals: TurnSignals = { revealedNow, techNow, dateChanged, interrupted: !!args.interrupted };
  const ctx = buildContext({ pack, state: s, history, userMessage: message, evidence, signals });

  // 4. Generación + verificación de fugas (una corrección; luego respuesta segura).
  let regenerated = false;
  let fallback = false;
  let res = await provider.complete({ system: ctx.system, messages: ctx.messages, maxTokens: 700, temperature: 0.85 });
  let parsed = parseModelOutput(res.text);
  let leaks = detectLeaks(parsed.reply, pack, s);

  if (leaks.any) {
    regenerated = true;
    const correction = {
      text: `CORRECCIÓN OBLIGATORIA: tu borrador mencionó cosas que NO sabés en esta fecha: ${describeLeaks(leaks)}. Reescribí la respuesta completa sin usar ni insinuar eso; si el interlocutor lo trajo, tratalo como noticia nueva y preguntá. Mantené el mismo formato de salida.`,
    };
    res = await provider.complete({ system: [...ctx.system, correction], messages: ctx.messages, maxTokens: 700, temperature: 0.7 });
    parsed = parseModelOutput(res.text);
    leaks = detectLeaks(parsed.reply, pack, s);
  }

  let out = s;
  let reply = parsed.reply;
  let basisRaw = parsed.basis;
  if (leaks.any || !reply) {
    fallback = true;
    reply = SAFE_FALLBACK;
    basisRaw = [];
  } else {
    out = applyPatch(s, parsed.patch, pack);
  }

  // 5. Fuentes: DOCUMENTADO sólo si cita fichas realmente recuperadas en este turno.
  const allowed = new Set(evidence.flatMap((r) => r.passage.source_ids));
  const registry = new Map(pack.source_registry.map((x) => [x.source_id, x]));
  const basis: BasisItem[] = basisRaw.map((b) => {
    const ids = b.source_ids.filter((id) => allowed.has(id) && registry.has(id));
    const kind: BasisKind = b.kind === "DOCUMENTADO" && ids.length === 0 ? "INFERENCIA" : b.kind;
    return {
      kind,
      text: b.text,
      sources: kind === "DOCUMENTADO"
        ? ids.map((id) => {
            const r = registry.get(id)!;
            return { source_id: r.source_id, title: r.title, author: r.author, date: r.date, reliability: r.reliability, url_checked: r.url_checked };
          })
        : [],
    };
  });

  return {
    reply,
    state: out,
    basis,
    meta: { regenerated, fallback, retrieved: evidence.map((r) => r.passage.id), model: res.model, usage: res.usage },
  };
}
