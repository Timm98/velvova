import { describe, expect, it } from "vitest";
import { anzeigenqualitaet } from "./anzeigenqualitaet.ts";
import { makeJob } from "./fixtures.ts";

describe("anzeigenqualitaet", () => {
  it("gibt einer vollständigen Anzeige 100", () => {
    const q = anzeigenqualitaet(makeJob());
    expect(q.score).toBe(100);
    expect(q.erfuellt).toBe(6);
  });

  it("rechnet in Sechsteln", () => {
    // Sechs Ja-Nein-Fragen, geteilt durch sechs — keine Gewichtung,
    // weil es keine begründbare gäbe.
    const q = anzeigenqualitaet(
      makeJob({ salary: { min: null, max: null, currency: "EUR", period: "year", disclosed: false, provenance: null, evidence: null } }),
    );
    expect(q.score).toBe(83);
  });

  it("zählt eine Zusage ohne Zahl nicht als Gehaltsangabe", () => {
    /*
     * `disclosed: true` ohne Betrag heisst „wir reden darüber", nicht
     * „hier steht es". Transparenz ist die Zahl, nicht die Absicht.
     */
    const q = anzeigenqualitaet(
      makeJob({ salary: { min: null, max: null, currency: "EUR", period: "year", disclosed: true, provenance: null, evidence: null } }),
    );
    expect(q.punkte.find((p) => p.key === "verguetung")?.erfuellt).toBe(false);
  });

  it("hält eine Remote-Stelle ohne Ort für transparent", () => {
    // Sie hat keinen Arbeitsort im üblichen Sinn — sie deswegen
    // abzuwerten wäre falsch.
    const q = anzeigenqualitaet(makeJob({ location: "", workModel: "remote" }));
    expect(q.punkte.find((p) => p.key === "arbeitsort")?.erfuellt).toBe(true);
  });

  it("meldet einen abgeschnittenen Text als Eingabeproblem", () => {
    /*
     * Bei unvollständig importiertem Text ist ein niedriger Wert kein
     * Befund über den Arbeitgeber. Der Auftrag verlangt, das zu
     * trennen.
     */
    expect(anzeigenqualitaet(makeJob({ description: "kurz" })).eingabeUnvollstaendig).toBe(true);
    expect(anzeigenqualitaet(makeJob()).eingabeUnvollstaendig).toBe(false);
  });

  it("begründet jeden Punkt", () => {
    for (const p of anzeigenqualitaet(makeJob()).punkte) {
      expect(p.satz.length).toBeGreaterThan(10);
    }
  });

  it("wertet fehlende Angaben als fehlende Transparenz, nicht als schlechte Stelle", () => {
    /*
     * Der Kern der Trennung: Eine Anzeige ohne Gehaltsangabe ist nicht
     * schlecht bezahlt. Deshalb steht in der Begründung, was FEHLT —
     * nicht, was das über die Stelle heisst.
     */
    const q = anzeigenqualitaet(
      makeJob({ salary: { min: null, max: null, currency: "EUR", period: "year", disclosed: false, provenance: null, evidence: null } }),
    );
    const satz = q.punkte.find((p) => p.key === "verguetung")!.satz;
    expect(satz).toMatch(/nennt kein Gehalt/);
    expect(satz).not.toMatch(/schlecht|niedrig|unfair/);
  });
});
