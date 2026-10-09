import { describe, expect, it } from "vitest";
import { peron } from "@/characters/peron";
import { detectLeaks, detectRevealed, detectTech, parseActiveDateDirective } from "@/lib/engine/gate";
import { newState } from "@/lib/engine/state";

const st = () => newState(peron, "t");

describe("temporal knowledge gate", () => {
  it("detecta que el usuario revela 1955 y no cambia la fecha activa", () => {
    const m = "General, en 1955 lo van a derrocar.";
    expect(detectRevealed(m, peron, "1951-05-01").map((e) => e.id)).toContain("f-1955-libertadora");
    expect(parseActiveDateDirective(m)).toBeNull();
  });

  it("bloquea una respuesta que confirma la Revolución Libertadora sin que el usuario la haya revelado", () => {
    const l = detectLeaks("Sí, la Revolución Libertadora fue un golpe cruel.", peron, st());
    expect(l.any).toBe(true);
    expect(l.events.map((e) => e.id)).toContain("f-1955-libertadora");
  });

  it("permite mencionarla cuando el usuario ya la reveló", () => {
    const s = st();
    s.known_future.push({ id: "f-1955-libertadora", label: "x", turn: 1, claim: "x" });
    s.years_seen.push(1955);
    const l = detectLeaks("¿Dice que esa Revolución Libertadora me sacaría en 1955?", peron, s);
    expect(l.events).toHaveLength(0);
    expect(l.years).toHaveLength(0);
  });

  it("bloquea años lejanos no mencionados, pero deja 1951 y 1952", () => {
    expect(detectLeaks("Para 1952 habrá elecciones; en 1951 ya veremos.", peron, st()).any).toBe(false);
    expect(detectLeaks("En 1974 pasarán cosas.", peron, st()).years).toEqual([1974]);
  });

  it("bloquea tecnología futura salvo que el usuario ya la nombró", () => {
    expect(detectLeaks("Eso lo ve en internet, supongo.", peron, st()).tech.map((t) => t.id)).toContain("internet");
    const s = st();
    s.tech_seen.push("internet");
    expect(detectLeaks("Entonces esa internet es como un telégrafo gigante.", peron, s).any).toBe(false);
  });

  it("no confunde 'televisión' ni 'huella digital' con anacronismos", () => {
    expect(detectLeaks("La televisión llegará pronto; tomaron su huella digital.", peron, st()).any).toBe(false);
  });

  it("detecta tecnología en el mensaje del usuario", () => {
    expect(detectTech("Uso inteligencia artificial y WhatsApp", peron).map((t) => t.id).sort()).toEqual(["ia", "redes-sociales"]);
  });

  it("detecta la muerte de Eva dicha por el usuario y por el modelo", () => {
    expect(detectRevealed("¿Sabe que Evita murió joven?", peron, "1951-05-01").map((e) => e.id)).toContain("f-1952-eva-muerte");
    expect(detectLeaks("Cuando Eva murió, todo cambió.", peron, st()).events.length).toBe(1);
  });

  it("respeta un cambio de fecha explícito y conservador", () => {
    expect(parseActiveDateDirective("Estamos en marzo de 1953, General.")).toBe("1953-03-01");
    expect(parseActiveDateDirective("Situémonos en 1955")).toBe("1955-01-01");
    expect(parseActiveDateDirective("Hoy es el 12 de agosto de 1952")).toBe("1952-08-12");
    expect(parseActiveDateDirective("Estamos en 2026")).toBeNull();
    expect(parseActiveDateDirective("En 1953 pasó algo")).toBeNull();
  });
});
