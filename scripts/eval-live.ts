/**
 * Corre los 12 tests del personaje contra el modelo REAL (requiere ANTHROPIC_API_KEY u OPENAI_API_KEY).
 * Uso: npm run eval:live -- peron
 * Escribe characters/<slug>/evaluation_report.json. La firma humana (manual_signoff) NO la pone este script.
 */
import fs from "node:fs";
import path from "node:path";
import { getCharacter } from "../characters";
import type { EvalCheck, EvaluationReport } from "../characters/types";
import { detectLeaks } from "../lib/engine/gate";
import { newState, type SessionState } from "../lib/engine/state";
import { countSentences } from "../lib/engine/text";
import { runTurn } from "../lib/engine/turn";
import { getProvider } from "../lib/llm";
import type { LLMMessage } from "../lib/llm/provider";

const slug = process.argv[2] ?? "peron";
const pack = getCharacter(slug);
if (!pack) throw new Error(`Personaje desconocido: ${slug}`);
const provider = getProvider();

function check(c: EvalCheck, replies: string[], state: SessionState): string | null {
  const pick = (at: number | "any" | "all") => (at === "any" || at === "all" ? replies : [replies[at] ?? ""]);
  switch (c.kind) {
    case "forbid":
      return pick(c.at).some((r) => new RegExp(c.pattern, c.flags ?? "i").test(r)) ? `PROHIBIDO (${c.why}): /${c.pattern}/` : null;
    case "require": {
      const ok = c.at === "any" ? replies.some((r) => new RegExp(c.pattern, c.flags ?? "i").test(r)) : new RegExp(c.pattern, c.flags ?? "i").test(replies[c.at] ?? "");
      return ok ? null : `FALTA (${c.why}): /${c.pattern}/`;
    }
    case "maxSentences":
      return pick(c.at).some((r) => countSentences(r) > c.n) ? `LARGO (${c.why}): más de ${c.n} frases` : null;
    case "eventRevealed":
      return state.known_future.some((k) => k.id === c.eventId) ? null : `MEMORIA (${c.why}): no registró ${c.eventId}`;
    case "techSeen":
      return state.tech_seen.includes(c.id) ? null : `MEMORIA (${c.why}): no registró ${c.id}`;
  }
}

const results: EvaluationReport["results"] = [];
let model: string | null = null;
for (const t of pack.evaluation_tests) {
  let state = newState(pack, `eval-${t.id}`);
  const history: LLMMessage[] = [{ role: "assistant", content: pack.profile.opening_message }];
  const replies: string[] = [];
  const failures: string[] = [];
  for (const turn of t.turns) {
    const r = await runTurn({ pack, state, history, message: turn.u, interrupted: turn.interrupted, provider });
    model = r.meta.model;
    if (r.meta.fallback) failures.push(`FALLBACK de seguridad en el turno ${r.state.turn}`);
    history.push({ role: "user", content: turn.u }, { role: "assistant", content: r.reply });
    replies.push(r.reply);
    state = r.state;
    const leak = detectLeaks(r.reply, pack, state);
    if (leak.any) failures.push(`FUGA temporal en el turno ${r.state.turn}`);
  }
  for (const c of t.checks) {
    const f = check(c, replies, state);
    if (f) failures.push(f);
  }
  results.push({ id: t.id, pass: failures.length === 0, failures });
  console.log(`${failures.length ? "✗" : "✓"} ${t.id}  ${t.title}`);
  failures.forEach((f) => console.log(`    - ${f}`));
  console.log(`    última respuesta: ${replies.at(-1)?.slice(0, 200)}`);
  if (t.manual) console.log(`    [revisión humana] ${t.manual}`);
}

const file = path.join(process.cwd(), "characters", slug, "evaluation_report.json");

const report: EvaluationReport = {
  at: new Date().toISOString(),
  model,
  automatic_pass: results.every((r) => r.pass),
  manual_signoff: false, // se resetea en cada corrida: la firma humana es posterior y explícita
  results,
};

fs.writeFileSync(file, JSON.stringify(report, null, 2) + "\n");
console.log(`\nAutomático: ${report.automatic_pass ? "APROBADO" : "NO APROBADO"} · Firma humana pendiente (editar manual_signoff en ${path.relative(process.cwd(), file)}).`);
process.exit(report.automatic_pass ? 0 : 1);
