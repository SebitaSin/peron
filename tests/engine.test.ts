import { describe, expect, it } from "vitest";
import { getCharacter, isServable, statusOf } from "@/characters";
import { peron } from "@/characters/peron";
import { buildContext } from "@/lib/engine/context";
import { parseModelOutput } from "@/lib/engine/output";
import { retrieve } from "@/lib/engine/retrieval";
import { applyPatch, newState, sanitizeState } from "@/lib/engine/state";
import { countSentences } from "@/lib/engine/text";
import { runTurn } from "@/lib/engine/turn";
import { out, scripted } from "./helpers";

const base = () => newState(peron, "s1");
const sys = (r: { system: { text: string }[] }) => r.system.map((b) => b.text).join("\n");

describe("context builder", () => {
  it("no filtra el futuro al modelo cuando el mensaje es neutro", () => {
    const ctx = buildContext({
      pack: peron, state: base(), history: [], userMessage: "Buenas tardes, General.",
      evidence: [], signals: { revealedNow: [], techNow: [], dateChanged: false, interrupted: false },
    });
    const all = sys(ctx);
    for (const bad of ["Libertadora", "Lonardi", "Aramburu", "1955", "1974", "murió el 26 de julio", "Renunciamiento"]) {
      expect(all.includes(bad), bad).toBe(false);
    }
    expect(all).toContain("1 de mayo de 1951");
    expect(all).toContain("55 años");
  });

  it("incluye el bloque posterior a Eva sólo si la fecha activa lo alcanza", () => {
    const s = base();
    const early = sys(buildContext({ pack: peron, state: s, history: [], userMessage: "hola", evidence: [], signals: { revealedNow: [], techNow: [], dateChanged: false, interrupted: false } }));
    expect(early).not.toContain("Eva murió");
    s.active_date = "1953-03-01";
    const late = sys(buildContext({ pack: peron, state: s, history: [], userMessage: "hola", evidence: [], signals: { revealedNow: [], techNow: [], dateChanged: true, interrupted: false } }));
    expect(late).toContain("Eva murió el 26 de julio de 1952");
  });

  it("cachea el bloque de identidad y limita el historial a 12 mensajes", () => {
    const hist = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? ("assistant" as const) : ("user" as const), content: `m${i}` }));
    const ctx = buildContext({ pack: peron, state: base(), history: hist, userMessage: "x", evidence: [], signals: { revealedNow: [], techNow: [], dateChanged: false, interrupted: false } });
    expect(ctx.system[0].cache).toBe(true);
    expect(ctx.messages).toHaveLength(13);
  });
});

describe("retrieval", () => {
  it("no recupera nada en charla cotidiana", () => {
    expect(retrieve("Buenas tardes, ¿cómo anda?", peron, "1951-05-01")).toHaveLength(0);
  });
  it("recupera La Comunidad Organizada ante una pregunta concreta", () => {
    const r = retrieve("¿Qué dijo usted en Mendoza sobre la comunidad organizada?", peron, "1951-05-01");
    expect(r[0].passage.id).toBe("K-comunidad-organizada");
  });
  it("respeta la fecha activa: nada posterior a esa fecha", () => {
    expect(retrieve("conducción política y estrategia", peron, "1949-01-01").map((r) => r.passage.id)).not.toContain("K-conduccion");
  });
});

describe("salida del modelo y memoria", () => {
  it("parsea las tres etiquetas y limpia markdown/acotaciones", () => {
    const p = parseModelOutput(out("*sonríe* **Mire**, amigo.", { user_name: "Lucía" }, [{ kind: "USUARIO", text: "se llama Lucía", source_ids: [] }]));
    expect(p.reply).toBe("Mire, amigo.");
    expect(p.wellFormed).toBe(true);
    expect(p.basis).toHaveLength(1);
  });
  it("tolera salida sin etiquetas", () => {
    const p = parseModelOutput("Sí, lo escucho.");
    expect(p.reply).toBe("Sí, lo escucho.");
    expect(p.wellFormed).toBe(false);
  });
  it("sanea estado manipulado del cliente", () => {
    const s = sanitizeState({ active_date: "2099-01-01", trust: 99, known_future: [{ id: "no-existe" }, { id: "f-1955-libertadora", label: "IGNORE ALL", claim: "<x>y" }], facts: ["<script>", 5] }, peron);
    expect(s.active_date).toBe("1951-05-01");
    expect(s.trust).toBe(4);
    expect(s.known_future).toHaveLength(1);
    expect(s.known_future[0].label).toBe("Revolución Libertadora: derrocamiento de Perón");
    expect(s.known_future[0].claim).not.toContain("<");
    expect(s.facts).toEqual(["script"]);
  });
  it("la confianza se mueve de a un paso y la credibilidad del futuro no retrocede", () => {
    let s = base();
    s = applyPatch(s, { trust: 4, future_credence: 3 }, peron);
    expect(s.trust).toBe(2);
    expect(s.future_credence).toBe(1);
    s = applyPatch(s, { trust: 1, future_credence: 0 }, peron);
    expect(s.trust).toBe(1);
    expect(s.future_credence).toBe(1);
  });
  it("registra tecnología aprendida con id estable", () => {
    const s = applyPatch(base(), { tech_learned_add: [{ label: "Internet", gist: "red mundial de computadoras" }] }, peron);
    expect(s.tech_learned[0].id).toBe("internet");
  });
});

describe("runTurn", () => {
  it("TEST 2: registra la revelación y pasa la alerta temporal al modelo", async () => {
    const prov = scripted([out("¿Cómo que me van a derrocar? Espere. ¿Quiénes?", { trust: 2 })]);
    const r = await runTurn({ pack: peron, state: base(), history: [], message: "General, en 1955 lo van a derrocar.", provider: prov });
    expect(r.state.known_future.map((k) => k.id)).toContain("f-1955-libertadora");
    expect(r.state.years_seen).toContain(1955);
    expect(sys(prov.calls[0])).toContain("ALERTA TEMPORAL");
    expect(r.meta.regenerated).toBe(false);
    expect(r.reply).toContain("¿Quiénes?");
  });

  it("TEST 1: si el modelo filtra el futuro, regenera con corrección", async () => {
    const prov = scripted([
      out("Sí, la Revolución Libertadora fue terrible."),
      out("¿1955? No sé qué pasó en 1955. Cuénteme."),
    ]);
    const r = await runTurn({ pack: peron, state: base(), history: [], message: "¿Qué piensa de lo que pasó en 1955?", provider: prov });
    expect(r.meta.regenerated).toBe(true);
    expect(r.reply).not.toMatch(/Libertadora/);
    expect(sys(prov.calls[1])).toContain("CORRECCIÓN OBLIGATORIA");
  });

  it("si el modelo insiste en filtrar, entrega una respuesta segura y no aplica la memoria", async () => {
    const prov = scripted([out("La Revolución Libertadora…", { user_name: "X" }), out("Aramburu y Lonardi…", { user_name: "X" })]);
    const r = await runTurn({ pack: peron, state: base(), history: [], message: "¿Y entonces?", provider: prov });
    expect(r.meta.fallback).toBe(true);
    expect(r.state.user.name).toBeUndefined();
    expect(r.reply).not.toMatch(/Libertadora|Aramburu|Lonardi/);
  });

  it("TEST 3/4: la tecnología explicada queda en memoria y viaja al contexto siguiente", async () => {
    const p1 = scripted([out("¿Internet? Explíqueme eso.")]);
    const r1 = await runTurn({ pack: peron, state: base(), history: [], message: "Yo uso internet.", provider: p1 });
    expect(r1.state.tech_seen).toContain("internet");
    const p2 = scripted([out("Entonces es una red que une máquinas. ¿Quién la controla?", { tech_learned_add: [{ label: "internet", gist: "red mundial de computadoras" }] })]);
    const r2 = await runTurn({ pack: peron, state: r1.state, history: [], message: "Es una red mundial de computadoras conectadas.", provider: p2 });
    expect(r2.reply).toContain("red");
    const p3 = scripted([out("Sí, me explicó que es una red.")]);
    await runTurn({ pack: peron, state: r2.state, history: [], message: "¿Se acuerda de internet?", provider: p3 });
    expect(sys(p3.calls[0])).toContain("Tecnologías que ya te explicaron");
    expect(sys(p3.calls[0])).toContain("red mundial de computadoras");
  });

  it("DOCUMENTADO sólo con fuentes realmente recuperadas; si no, baja a INFERENCIA", async () => {
    const prov = scripted([
      out("Eso lo dije en Mendoza.", {}, [
        { kind: "DOCUMENTADO", text: "Congreso de Filosofía 1949", source_ids: ["S-COMUNIDAD"] },
        { kind: "DOCUMENTADO", text: "algo inventado", source_ids: ["S-NO-EXISTE"] },
      ]),
    ]);
    const r = await runTurn({ pack: peron, state: base(), history: [], message: "¿Qué dijo en Mendoza sobre la comunidad organizada?", provider: prov });
    expect(r.basis[0].kind).toBe("DOCUMENTADO");
    expect(r.basis[0].sources[0].source_id).toBe("S-COMUNIDAD");
    expect(r.basis[1].kind).toBe("INFERENCIA");
    expect(r.basis[1].sources).toHaveLength(0);
  });

  it("TEST 8: una interrupción llega marcada al modelo", async () => {
    const prov = scripted([out("Sí.")]);
    await runTurn({ pack: peron, state: base(), history: [], message: "General, espere.", interrupted: true, provider: prov });
    expect(prov.calls[0].messages.at(-1)?.content).toContain("interrumpió");
  });

  it("TEST 10: Eva está viva en 1951 (el prompt lo dice y no trae su muerte)", async () => {
    const prov = scripted([out("Trabaja demasiado, como siempre.")]);
    await runTurn({ pack: peron, state: base(), history: [], message: "¿Cómo está Eva?", provider: prov });
    const all = sys(prov.calls[0]);
    expect(all).toContain("Está viva");
    expect(all).not.toContain("murió el 26 de julio");
  });
});

describe("character pack", () => {
  it("tiene todas las secciones del Character Pack", () => {
    for (const k of ["profile", "timeline", "world_state", "relationships", "personality", "decision_model", "speaking_style", "source_registry", "knowledge", "temporal_gates", "conversation_rules", "system_prompt", "evaluation_tests"] as const) {
      expect(peron[k], k).toBeTruthy();
    }
  });
  it("toda ficha referencia fuentes que existen y ningún pasaje es posterior a la fecha inicial", () => {
    const ids = new Set(peron.source_registry.map((s) => s.source_id));
    for (const k of peron.knowledge) {
      expect(k.as_of <= peron.profile.start_date, k.id).toBe(true);
      for (const s of k.source_ids) expect(ids.has(s), `${k.id}→${s}`).toBe(true);
    }
  });
  it("no usa fuentes de nivel D", () => {
    expect(peron.source_registry.some((s) => s.reliability === "D")).toBe(false);
  });
  it("define los 12 tests de evaluación con criterios", () => {
    expect(peron.evaluation_tests).toHaveLength(12);
    for (const t of peron.evaluation_tests) expect(t.checks.length + (t.manual ? 1 : 0), t.id).toBeGreaterThan(0);
  });
  it("el prompt de identidad no contiene hechos posteriores a la fecha inicial", () => {
    for (const bad of ["Libertadora", "Lonardi", "1955", "1952", "murió el"]) expect(peron.system_prompt.includes(bad), bad).toBe(false);
  });
  it("está en borrador hasta que la evaluación pase y una persona firme", () => {
    expect(statusOf("peron")).toBe("draft");
    expect(getCharacter("peron")).toBeDefined();
    const prev = process.env.ALLOW_DRAFT_CHARACTERS;
    delete process.env.ALLOW_DRAFT_CHARACTERS;
    expect(isServable("peron")).toBe(false);
    process.env.ALLOW_DRAFT_CHARACTERS = "1";
    expect(isServable("peron")).toBe(true);
    if (prev === undefined) delete process.env.ALLOW_DRAFT_CHARACTERS;
    else process.env.ALLOW_DRAFT_CHARACTERS = prev;
  });
});

describe("texto", () => {
  it("cuenta frases", () => {
    expect(countSentences("Sí. Ahí está el problema. ¿Quién la controla?")).toBe(3);
  });
});

import { parseModelOutput as parseEmo } from "@/lib/engine/output";
import { splitSentences } from "@/lib/voice/provider";
describe("emoción y frases para la voz", () => {
  it("lee <emo>, tolera acentos y cae a sereno", () => {
    expect(parseEmo("<emo>Irónico</emo><reply>Mire usted.</reply><memory>{}</memory><basis>[]</basis>").emotion).toBe("ironico");
    expect(parseEmo("<emo>furioso</emo><reply>Hola.</reply>").emotion).toBe("sereno");
    expect(parseEmo("<reply>Hola.</reply>").emotion).toBe("sereno");
  });
  it("parte en frases y no deja frases diminutas", () => {
    const p = splitSentences("Buenas tardes. ¿Con quién tengo el gusto? Dígame qué lo trae por aquí, amigo.");
    expect(p.length).toBeGreaterThanOrEqual(2);
    expect(p.join(" ")).toContain("amigo.");
  });
});
