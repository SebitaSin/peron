export type Level = "A" | "B" | "C" | "D";

/** Expresión regular serializable. Por defecto sin distinguir mayúsculas. */
export interface Term {
  src: string;
  flags?: string;
}

export interface SourceRecord {
  source_id: string;
  title: string;
  author: string;
  date: string;
  type: string;
  url_archive: string;
  historical_period: string;
  reliability: Level;
  topics: string[];
  notes: string;
  /** true sólo si alguien abrió el original y confirmó URL/ficha. */
  url_checked: boolean;
}

export interface KnowledgePassage {
  id: string;
  source_ids: string[];
  topics: string[];
  keywords: string[];
  /** Fecha ISO hasta la cual el contenido describe hechos (el pasaje no se recupera antes de esa fecha activa). */
  as_of: string;
  text: string;
  confidence: "alta" | "media";
}

export interface TimelineEvent {
  id: string;
  date: string;
  label: string;
  summary: string;
  /** Términos específicos: sirven para detectar fugas en la respuesta y revelaciones del usuario. */
  terms: Term[];
  /** Términos adicionales, más amplios, sólo para detectar que el usuario reveló el evento. */
  user_terms?: Term[];
}

export interface TechConcept {
  id: string;
  label: string;
  terms: Term[];
}

export interface Relationship {
  id: string;
  name: string;
  role: string;
  from?: string;
  until?: string;
  note: string;
}

export type EvalCheck =
  | { kind: "forbid"; at: number | "any"; pattern: string; flags?: string; why: string }
  | { kind: "require"; at: number | "any"; pattern: string; flags?: string; why: string }
  | { kind: "maxSentences"; at: number | "all"; n: number; why: string }
  | { kind: "eventRevealed"; eventId: string; why: string }
  | { kind: "techSeen"; id: string; why: string };

export interface EvalTurn {
  u: string;
  interrupted?: boolean;
}

export interface EvalTest {
  id: string;
  title: string;
  turns: EvalTurn[];
  checks: EvalCheck[];
  /** Criterio que sólo puede juzgar una persona. */
  manual?: string;
}

export interface CharacterProfile {
  name: string;
  short_name: string;
  place: string;
  birth_date?: string;
  start_date: string;
  date_label: string;
  tagline: string;
  opening_message: string;
  og_title: string;
  og_description: string;
  disclaimer: string;
}

export interface CharacterPack {
  slug: string;
  version: string;
  profile: CharacterProfile;
  timeline: TimelineEvent[];
  world_state: { baseline: { text: string; from?: string; until?: string }[] };
  relationships: Relationship[];
  personality: string;
  decision_model: string;
  speaking_style: string;
  source_registry: SourceRecord[];
  knowledge: KnowledgePassage[];
  temporal_gates: {
    anachronisms: TechConcept[];
    conditional_blocks: { from: string; text: string }[];
  };
  conversation_rules: string;
  system_prompt: string;
  evaluation_tests: EvalTest[];
}

export interface EvaluationReport {
  at: string | null;
  model: string | null;
  automatic_pass: boolean;
  manual_signoff: boolean;
  results: { id: string; pass: boolean; failures: string[] }[];
}

export type CharacterStatus = "draft" | "published";

export interface PublicCharacter {
  slug: string;
  status: CharacterStatus;
  profile: CharacterProfile;
}
