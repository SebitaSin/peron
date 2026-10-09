/**
 * Modo Investigación: las 15 etapas para construir un Character Pack nuevo.
 * Este módulo define el contrato y genera el andamiaje; la recolección la ejecuta un investigador (persona o agente)
 * con fuentes reales. Ninguna etapa se da por cumplida sin fichas en el registro de fuentes.
 */
export interface Stage {
  n: number;
  id: string;
  title: string;
  output: string;
  accept: string;
}

export const STAGES: Stage[] = [
  { n: 1, id: "cronologia", title: "Cronología", output: "timeline.ts (eventos con fecha exacta o marca de aproximación)", accept: "Cada evento con ≥1 fuente nivel A/B; fechas dudosas marcadas." },
  { n: 2, id: "primarias", title: "Fuentes primarias", output: "source_registry (nivel A)", accept: "Cada ficha con source_id, título, autor, fecha, tipo, URL/archivo, período, confiabilidad, temas, notas." },
  { n: 3, id: "cartas", title: "Cartas y correspondencia", output: "source_registry + knowledge", accept: "Sólo cartas fechadas y atribuibles; transcripción cotejada con original." },
  { n: 4, id: "escritos", title: "Escritos y discursos completos", output: "source_registry + knowledge", accept: "Textos completos, no antologías de frases." },
  { n: 5, id: "entrevistas", title: "Entrevistas completas", output: "source_registry + speaking_style", accept: "Audio/video o transcripción íntegra; fecha y entrevistador." },
  { n: 6, id: "audiovisual", title: "Audio y video", output: "speaking_style", accept: "Ritmo, léxico y registro oral documentados por escucha, no por imitación de frases célebres." },
  { n: 7, id: "contemporaneos", title: "Testimonios y prensa contemporánea", output: "knowledge", accept: "Independientes entre sí; contraste de versiones." },
  { n: 8, id: "biografias", title: "Biografías serias", output: "source_registry (nivel C)", accept: "Académicas y documentadas; cada dato clave cotejado con nivel A/B." },
  { n: 9, id: "relaciones", title: "Relaciones", output: "relationships", accept: "Personas, roles, intervalos de tiempo y afecto/conflicto." },
  { n: 10, id: "decisiones", title: "Decisiones críticas", output: "decision_model", accept: "Al menos 8 decisiones con contexto, alternativas y criterio observable." },
  { n: 11, id: "estilo-oral", title: "Estilo oral", output: "speaking_style", accept: "Regla de registro, longitud y muletillas con moderación; sin acento fonético." },
  { n: 12, id: "contradicciones", title: "Contradicciones", output: "personality + knowledge", accept: "Cambios de postura explicados por situación, información, táctica o criterio." },
  { n: 13, id: "evolucion", title: "Evolución por edad/período", output: "timeline + world_state", accept: "El personaje en cada fecha activa posible es coherente con esa etapa." },
  { n: 14, id: "limites-temporales", title: "Límites temporales", output: "temporal_gates", accept: "Eventos futuros con términos de detección; anacronismos técnicos; sin hechos posteriores en el prompt base." },
  { n: 15, id: "adversariales", title: "Tests adversariales", output: "evaluation_tests + evaluation_report.json", accept: "Pasan los tests automáticos y una persona firma manual_signoff." },
];

export function checklistMarkdown(name: string, slug: string): string {
  return [
    `# Investigación: ${name} (${slug})`,
    "",
    "Regla: nivel D (memes, frases sin procedencia, anécdotas no verificadas) nunca define personalidad ni hechos.",
    "",
    ...STAGES.map((s) => `- [ ] **${s.n}. ${s.title}** → ${s.output}\n  - Criterio: ${s.accept}`),
    "",
    "## Publicación",
    "- [ ] `npm run eval:live -- " + slug + "` aprobado",
    "- [ ] Revisión humana de los criterios `manual` y `manual_signoff: true`",
    "- [ ] `npm run gate` en verde",
    "",
  ].join("\n");
}

export function packSkeleton(name: string, slug: string): Record<string, string> {
  const ident = slug.replace(/-/g, "_");
  return {
    "sources.ts": `import type { SourceRecord } from "../types";\n\nexport const ${ident.toUpperCase()}_SOURCES: SourceRecord[] = [\n  // Completar en la etapa 2. Una ficha por fuente real; url_checked sólo en true si alguien abrió el original.\n];\n`,
    "knowledge.ts": `import type { KnowledgePassage } from "../types";\n\nexport const ${ident.toUpperCase()}_KNOWLEDGE: KnowledgePassage[] = [\n  // Pasajes parafraseados con source_ids existentes y as_of <= fecha inicial.\n];\n`,
    "timeline.ts": `import type { TechConcept, TimelineEvent } from "../types";\n\nexport const ${ident.toUpperCase()}_TIMELINE: TimelineEvent[] = [];\nexport const ${ident.toUpperCase()}_ANACHRONISMS: TechConcept[] = [];\n`,
    "evaluation_tests.ts": `import type { EvalTest } from "../types";\n\nexport const ${ident.toUpperCase()}_EVAL_TESTS: EvalTest[] = [];\n`,
    "evaluation_report.json": JSON.stringify({ at: null, model: null, automatic_pass: false, manual_signoff: false, results: [] }, null, 2) + "\n",
    "README.md": `# ${name}\n\nPack en construcción. Ver research/${slug}/CHECKLIST.md. Copiar la estructura de characters/peron/index.ts y registrar el personaje en characters/index.ts.\n`,
  };
}
