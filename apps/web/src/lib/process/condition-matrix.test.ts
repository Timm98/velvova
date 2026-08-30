import { describe, expect, it } from "vitest";
import { buildPreflight, type PreflightInput } from "./condition-matrix.ts";

/**
 * Der teuerste Ablauf in einer Jobsuche: vier Gespräche, drei Wochen,
 * und dann stellt sich heraus, dass die Stelle 40 % Reisetätigkeit
 * verlangt.
 *
 * Das mittlere Fach — „unklar" — ist das wichtigste. Ein Produkt, das
 * Unbekanntes als unproblematisch behandelt, verschiebt die böse
 * Überraschung nur nach hinten.
 */

const pf = (description: string, over: Partial<PreflightInput> = {}) =>
  buildPreflight({ description, ...over });

describe("Bestätigte Bedingungen", () => {
  it("liest, was in der Anzeige steht", () => {
    const r = pf(
      "Unbefristet in Vollzeit, hybrid mit 2 Tagen im Büro. Gehalt 48.000 – 56.000 EUR.",
    );
    const keys = r.confirmed.map((c) => c.key);
    expect(keys).toContain("contract");
    expect(keys).toContain("hours");
    expect(keys).toContain("remote");
    expect(keys).toContain("salary");
  });

  it("nennt zu jeder Angabe die Fundstelle", () => {
    // Ohne Fundstelle kann die Person nicht prüfen, ob wir richtig
    // gelesen haben.
    const r = pf("Die Stelle ist unbefristet.");
    const vertrag = r.confirmed.find((c) => c.key === "contract")!;
    expect(vertrag.evidence).toContain("unbefristet");
  });
});

describe("Unklare Bedingungen", () => {
  it("behandelt Fehlendes als eigenen Zustand, nicht als unproblematisch", () => {
    const r = pf("Wir suchen Verstärkung für unser Team.");
    expect(r.unclear.length).toBeGreaterThan(4);
    for (const u of r.unclear) {
      expect(u.status).toBe("unknown");
      expect(u.confidence).toBe(0);
    }
  });

  it("erzeugt zu jedem unklaren Punkt eine konkrete Frage", () => {
    const r = pf("Wir suchen Verstärkung.");
    expect(r.questions.length).toBeGreaterThan(0);
    expect(r.questions.join(" ")).toMatch(/\?/);
  });

  it("stellt höchstens fünf Fragen", () => {
    // Mehr liest niemand, und mehr merkt sich niemand im Gespräch.
    const r = pf("Kurze Anzeige ohne Angaben.");
    expect(r.questions.length).toBeLessThanOrEqual(5);
  });

  it("rät bei vielen offenen Punkten zum Klären statt zum Bewerben", () => {
    const r = pf("Wir suchen Verstärkung.");
    expect(r.recommendation).toBe("clarify_first");
  });
});

describe("Konflikte", () => {
  it("erkennt einen Reiseanteil über der eigenen Grenze", () => {
    const r = pf("Reisebereitschaft von 40 % wird vorausgesetzt.", {
      userConstraints: { maxTravelPercent: 20 },
    });
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]!.explanation).toContain("40");
    expect(r.conflicts[0]!.explanation).toContain("20");
    expect(r.recommendation).toBe("deprioritise");
  });

  it("meldet keinen Konflikt, wenn der Anteil darunter liegt", () => {
    const r = pf("Reiseanteil 10 %.", { userConstraints: { maxTravelPercent: 20 } });
    expect(r.conflicts).toEqual([]);
  });

  it("erkennt Schichtarbeit gegen einen Ausschluss", () => {
    const r = pf("Arbeit im rollierenden Drei-Schicht-System.", {
      userConstraints: { noShiftWork: true },
    });
    expect(r.conflicts.map((c) => c.key)).toContain("shift");
  });

  it("erfindet keinen Konflikt ohne eigene Bedingung", () => {
    const r = pf("Reisebereitschaft von 40 %.");
    expect(r.conflicts).toEqual([]);
  });
});

describe("Empfehlung", () => {
  it("rät zum Vorbereiten, wenn genug belegt ist", () => {
    const r = pf(
      "Unbefristet, Vollzeit, hybrid mit 2 Tagen im Büro, Gehalt 48.000 – 56.000 EUR, " +
        "ab sofort, Team aus 8 Personen, Reiseanteil 5 %, keine Schichtarbeit.",
    );
    expect(r.recommendation).toBe("prepare");
  });

  it("stellt den Konflikt über die Vollständigkeit", () => {
    // Eine gut ausgefüllte Anzeige mit einem harten Widerspruch bleibt
    // ein harter Widerspruch.
    const r = pf(
      "Unbefristet, Vollzeit, hybrid 2 Tage, 48.000 – 56.000 EUR, ab sofort, " +
        "Team aus 8 Personen, Reisebereitschaft 60 %.",
      { userConstraints: { maxTravelPercent: 20 } },
    );
    expect(r.recommendation).toBe("deprioritise");
  });
});

describe("Verneinung", () => {
  it("liest „keine Schichtarbeit“ nicht als Schichtarbeit", () => {
    // Ein Muster, das nur nach dem Substantiv sucht, meldet Schichtdienst
    // in einer Anzeige, die ausdrücklich keinen hat — und erzeugt einen
    // Konflikt, den es nicht gibt.
    const r = pf("Keine Schichtarbeit, geregelte Arbeitszeiten.", {
      userConstraints: { noShiftWork: true },
    });
    expect(r.conflicts.map((c) => c.key)).not.toContain("shift");
    expect(r.confirmed.find((c) => c.key === "shift")?.negated).toBe(true);
  });

  it("liest „ohne Reisetätigkeit“ nicht als Reisetätigkeit", () => {
    const r = pf("Ohne Reisebereitschaft.", { userConstraints: { maxTravelPercent: 0 } });
    expect(r.conflicts).toEqual([]);
  });

  it("erkennt die Verneinung im Wert", () => {
    const r = pf("Keine Schichtarbeit.");
    expect(r.confirmed.find((c) => c.key === "shift")?.value).toMatch(/^keine/i);
  });
});
