import type { CharacterPack, TechConcept, TimelineEvent } from "@/characters/types";
import type { LLMMessage, SystemBlock } from "@/lib/llm/provider";
import { pastEvents } from "./gate";
import type { Retrieved } from "./retrieval";
import type { SessionState } from "./state";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function dateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

const TRUST: Record<number, string> = {
  1: "Etapa 1 (desconocido): trato cordial y cierta cautela. Todavía no lo llames 'compañero'.",
  2: "Etapa 2 (interlocutor interesante): más curiosidad; preguntás más.",
  3: "Etapa 3 (confianza): podés decir 'amigo' o 'compañero' si cae natural.",
  4: "Etapa 4 (conversación íntima): opiniones más francas, humor, dudas y preocupaciones.",
};
const CREDENCE: Record<number, string> = {
  0: "El interlocutor todavía no dijo venir del futuro.",
  1: "El interlocutor dice venir del futuro; sos escéptico pero curioso y podés pedir una prueba verificable.",
  2: "Ya te dio señales que no podría conocer: dudás menos, aunque no creés todo.",
  3: "Ya estás convencido de que habla desde el futuro: no vuelvas al escepticismo inicial.",
};

function ageAt(birth: string, on: string): number {
  const [by, bm, bd] = birth.split("-").map(Number);
  const [y, m, d] = on.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

function eventLine(e: TimelineEvent): string {
  return `- ${dateLabel(e.date)}: ${e.label}. ${e.summary}`;
}

export function worldStateAt(pack: CharacterPack, state: SessionState): string {
  const past = pastEvents(pack, state.active_date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);
  const rel = pack.relationships.filter(
    (r) => (!r.from || r.from <= state.active_date) && (!r.until || r.until >= state.active_date),
  );
  const cond = pack.temporal_gates.conditional_blocks.filter((b) => state.active_date >= b.from).map((b) => b.text);
  return [
    `Fecha activa: ${dateLabel(state.active_date)}. Lugar: ${pack.profile.place}. Tu conocimiento termina en esa fecha.`,
    ...(pack.profile.birth_date ? [`- Tenés ${ageAt(pack.profile.birth_date, state.active_date)} años.`] : []),
    ...pack.world_state.baseline
      .filter((b) => (!b.from || b.from <= state.active_date) && (!b.until || b.until >= state.active_date))
      .map((b) => `- ${b.text}`),
    "Hechos que ya ocurrieron y conocés bien:",
    ...past.map(eventLine),
    "Personas en tu entorno a esa fecha:",
    ...rel.map((r) => `- ${r.name} (${r.role}): ${r.note}`),
    ...cond,
  ].join("\n");
}

function memoryBlock(s: SessionState): string {
  const L: string[] = ["MEMORIA DE ESTA CONVERSACIÓN (lo que sabés de tu interlocutor; usalo sólo cuando cae natural):"];
  const u = s.user;
  const who = [u.name && `se llama ${u.name}`, u.profession && `profesión: ${u.profession}`, u.origin && `de ${u.origin}`, u.from_year && `dice venir del año ${u.from_year}`].filter(Boolean);
  if (who.length) L.push(`- Interlocutor: ${who.join("; ")}.`);
  L.push(`- ${TRUST[s.trust]}`);
  L.push(`- ${CREDENCE[s.future_credence]}`);
  if (s.known_future.length) {
    L.push("- Noticias sobre el futuro que el interlocutor ya te contó (las aprendiste en esta conversación, con la fecha del turno):");
    for (const k of s.known_future) L.push(`  · ${k.label} — dicho como: "${k.claim}"`);
  }
  if (s.tech_learned.length) {
    L.push("- Tecnologías que ya te explicaron y entendés (no vuelvas a preguntar qué son):");
    for (const t of s.tech_learned) L.push(`  · ${t.label}: ${t.gist}`);
  }
  const seenNotLearned = s.tech_seen.filter((id) => !s.tech_learned.some((t) => t.id === id));
  if (seenNotLearned.length) L.push(`- Mencionadas pero no explicadas del todo: ${seenNotLearned.join(", ")}.`);
  for (const [k, v] of [["Hechos que contó", s.facts], ["Charlas políticas", s.political], ["Temas personales", s.personal], ["Bromas compartidas", s.jokes], ["Preguntas tuyas pendientes", s.pending]] as const) {
    if (v.length) L.push(`- ${k}: ${v.join(" | ")}`);
  }
  if (s.open_thread) L.push(`- Hilo que quedó cortado (si dice "continúe", retomalo exactamente de acá): ${s.open_thread}`);
  if (s.summary) L.push(`- Resumen de lo conversado: ${s.summary}`);
  return L.join("\n");
}

export interface TurnSignals {
  revealedNow: TimelineEvent[];
  techNow: TechConcept[];
  dateChanged: boolean;
  interrupted: boolean;
}

function signalsBlock(sig: TurnSignals, s: SessionState): string {
  const L: string[] = [];
  for (const e of sig.revealedNow) {
    L.push(
      `ALERTA TEMPORAL: en este mensaje el interlocutor nombra o afirma algo ("${e.label}") que para vos TODAVÍA NO OCURRIÓ. Es una noticia nueva, posiblemente sobre tu propia vida. Reaccioná como persona (sorpresa, desconfianza, curiosidad) y preguntá. NO la confirmes ni agregues detalles que no te dio.`,
    );
  }
  for (const t of sig.techNow) {
    L.push(`ALERTA TECNOLÓGICA: el interlocutor menciona "${t.label}". No lo conocés: pedí que te lo explique y comprendelo por analogía (telégrafo, radio, prensa, correo, logística, inteligencia).`);
  }
  if (sig.dateChanged) L.push(`CAMBIO DE FECHA: el interlocutor te situó en ${dateLabel(s.active_date)}. Esa fecha manda desde ahora.`);
  if (sig.interrupted) L.push("El interlocutor te interrumpió mientras hablabas: dejá el hilo anterior, atendé lo nuevo en una o dos frases.");
  if (s.turn <= 1) L.push("Es el comienzo de la conversación; todavía no sabés quién es.");
  return L.join("\n");
}

function evidenceBlock(ev: Retrieved[]): string {
  if (!ev.length) return "";
  return [
    "EVIDENCIA DOCUMENTAL DISPONIBLE (para esta pregunta; hablá desde tu memoria de Perón, sin citar ni recitar fichas; si algo no figura acá o no lo recordás, decí que no lo recordás):",
    ...ev.map((r) => `[${r.passage.id} | fuentes: ${r.passage.source_ids.join(",")} | confianza ${r.passage.confidence}] ${r.passage.text}`),
  ].join("\n");
}

export interface BuiltContext {
  system: SystemBlock[];
  messages: LLMMessage[];
}

export function buildContext(args: {
  pack: CharacterPack;
  state: SessionState;
  history: LLMMessage[];
  userMessage: string;
  evidence: Retrieved[];
  signals: TurnSignals;
}): BuiltContext {
  const { pack, state, history, userMessage, evidence, signals } = args;
  const dynamic = [
    "ESTADO DEL MUNDO Y CONOCIMIENTO TEMPORAL",
    worldStateAt(pack, state),
    "Todo lo posterior a esa fecha es desconocido para vos. Si el interlocutor pregunta por eso y no te lo contó antes, ignorás el tema y preguntás.",
    memoryBlock(state),
    signalsBlock(signals, state),
    evidenceBlock(evidence),
  ]
    .filter(Boolean)
    .join("\n\n");

  const recent = history.slice(-12);
  const note = signals.interrupted ? " [lo interrumpió mientras hablabas]" : "";
  return {
    system: [{ text: pack.system_prompt, cache: true }, { text: dynamic }],
    messages: [...recent, { role: "user", content: userMessage + note }],
  };
}
