import { describe, expect, it } from "vitest";
import { passungsbild, passungszeilen, vorsprungssatz } from "./passungsbild.ts";
import type { Abgleichbefund } from "./scoring.ts";

const B = (teil: Partial<Abgleichbefund>): Abgleichbefund => ({
  anforderung: "Erfahrung in der Kommissionierung",
  art: "must",
  stand: "erfuellt",
  schluessel: "kommissionierung",
  belege: ["ev-1"],
  satz: "",
  ...teil,
});

const bed = (verdict: "eligible" | "uncertain" | "blocked", label = "Arbeitszeit") => ({ label, verdict });

describe("Vier Aussagen statt einer Zahl", () => {
  it("zählt Muss-Anforderungen getrennt nach Stand", () => {
    const p = passungsbild(
      [B({}), B({ stand: "teilweise" }), B({ stand: "nicht_belegt", belege: [] })],
      [],
      70,
      0.6,
    );
    expect(p.fachlich).toMatchObject({ erfuellt: 1, teilweise: 1, nichtBelegt: 1, geprueft: 3 });
  });

  it("lässt Kann-Anforderungen aus der Muss-Rechnung heraus", () => {
    const p = passungsbild([B({ art: "nice" })], [], 70, 0.6);
    expect(p.fachlich.geprueft).toBe(0);
  });

  it("hält Bedingungen von der fachlichen Aussage getrennt", () => {
    const p = passungsbild([B({})], [bed("blocked", "Nachtschicht")], 70, 0.6);
    expect(p.fachlich.erfuellt).toBe(1);
    expect(p.bedingungen.verletzt).toBe(1);
    /* Die verletzte Bedingung senkt die fachliche Aussage nicht. */
    expect(p.fachlich.nichtBelegt).toBe(0);
  });

  it("rechnet die Nachweisdeckung über alle geprüften Anforderungen", () => {
    const p = passungsbild([B({}), B({ stand: "nicht_belegt", belege: [] })], [], 70, 0.6);
    expect(p.nachweisdeckung).toBe(0.5);
  });

  it("sagt nichts, wo nichts geprüft wurde", () => {
    expect(passungsbild([], [], null, 0).nachweisdeckung).toBeNull();
  });
});

describe("Die Zeilen daneben", () => {
  it("nennt die verletzte Bedingung im Klartext", () => {
    const z = passungszeilen(passungsbild([B({})], [bed("blocked", "Nachtschicht")], 70, 0.6));
    expect(z[1]).toContain("Nachtschicht");
  });

  it("sagt bei fehlender Anforderung, dass nichts zu prüfen war", () => {
    const z = passungszeilen(passungsbild([], [bed("eligible")], null, 0.2));
    expect(z[0]).toContain("keine prüfbare Anforderung");
  });

  it("führt das Offene auf", () => {
    const z = passungszeilen(
      passungsbild([B({ stand: "nicht_belegt", anforderung: "SAP EWM", belege: [] })], [], 40, 0.5),
    );
    expect(z.join(" ")).toContain("SAP EWM");
  });
});

describe("Warum eine Stelle vor der anderen steht", () => {
  it("nennt zuerst die Bedingungen", () => {
    const a = passungsbild([B({})], [bed("eligible")], 60, 0.6);
    const b = passungsbild([B({}), B({})], [bed("blocked", "Nachtschicht")], 90, 0.6);
    expect(vorsprungssatz(a, b)).toContain("Bedingungen");
  });

  it("nennt danach die belegten Muss-Anforderungen", () => {
    const a = passungsbild([B({}), B({})], [], 60, 0.6);
    const b = passungsbild([B({})], [], 90, 0.6);
    expect(vorsprungssatz(a, b)).toContain("2 gegen 1");
  });

  it("gibt zu, wenn die Daten keinen Unterschied hergeben", () => {
    const a = passungsbild([B({})], [], 60, 0.6);
    const b = passungsbild([B({})], [], 60, 0.6);
    expect(vorsprungssatz(a, b)).toContain("willkürlich");
  });
});
