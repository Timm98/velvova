import { describe, expect, it } from "vitest";
import {
  erkenntnisart,
  konfidenzband,
  staerkerer,
  traegtEntscheidung,
  wirksameKonfidenz,
  type Beleg,
} from "./erkenntnis.ts";

const beleg = (t: Partial<Beleg> & Pick<Beleg, "quelle">): Beleg => ({ konfidenz: 0.8, ...t });

describe("Was eine Angabe ist", () => {
  it("nennt eine Modellableitung eine Vermutung", () => {
    expect(erkenntnisart(beleg({ quelle: "ai_hypothesis" }))).toBe("inference");
  });

  it("nennt ein Dokument einen Fakt", () => {
    /* Der Lebenslauf belegt Python-Erfahrung — das ist keine Vermutung. */
    expect(erkenntnisart(beleg({ quelle: "document_extract" }))).toBe("fact");
    expect(erkenntnisart(beleg({ quelle: "work_sample" }))).toBe("fact");
  });

  it("nennt eine Aussage eine Präferenz", () => {
    expect(erkenntnisart(beleg({ quelle: "user_stated" }))).toBe("preference");
  });

  it("macht aus einer bestätigten Vermutung einen Fakt", () => {
    /* Erst die Zustimmung der Person macht daraus etwas Festes. */
    expect(erkenntnisart(beleg({ quelle: "ai_hypothesis", bestaetigt: true }))).toBe("fact");
  });
});

describe("Der Deckel auf der Konfidenz", () => {
  it("lässt eine Vermutung nicht in das Band starker Evidenz", () => {
    /*
     * Der gemessene Zustand: 44 Belege `ai_hypothesis · constraint`
     * mit Konfidenz 0.90 — über den 0.82 dessen, was Menschen selbst
     * gesagt haben.
     */
    const vermutung = beleg({ quelle: "ai_hypothesis", konfidenz: 0.9 });
    expect(wirksameKonfidenz(vermutung)).toBeLessThanOrEqual(0.74);
    expect(konfidenzband(wirksameKonfidenz(vermutung))).toBe("plausibel");
  });

  it("lässt den gespeicherten Wert unangetastet", () => {
    /* Er dokumentiert, was das Modell damals meinte. */
    const v = beleg({ quelle: "ai_hypothesis", konfidenz: 0.9 });
    wirksameKonfidenz(v);
    expect(v.konfidenz).toBe(0.9);
  });

  it("gibt einer Aussage ihr volles Gewicht", () => {
    expect(wirksameKonfidenz(beleg({ quelle: "user_stated", konfidenz: 0.9 }))).toBe(0.9);
  });

  it("macht aus einer abgelehnten Angabe eine ohne Gewicht", () => {
    expect(wirksameKonfidenz(beleg({ quelle: "user_stated", abgelehnt: true }))).toBe(0);
  });

  it("hebt eine bestätigte auf volle Sicherheit", () => {
    expect(wirksameKonfidenz(beleg({ quelle: "ai_hypothesis", bestaetigt: true }))).toBe(1);
  });
});

describe("Wer im Widerspruch gewinnt", () => {
  it("die Aussage der Person schlägt die Vermutung — auch die sicherere", () => {
    /*
     * Das Beispiel aus dem Auftrag: Nina leitet „möchte remote" ab
     * (0.62), später sagt die Person „ich will jeden Tag ins Büro".
     *
     * Und der schärfere Fall: Selbst wenn die Vermutung mit 0.95
     * gespeichert wurde, gewinnt sie nicht. Genau das war der Fehler
     * in den Daten.
     */
    const vermutung = beleg({ quelle: "ai_hypothesis", konfidenz: 0.95 });
    const aussage = beleg({ quelle: "user_stated", konfidenz: 0.7 });
    expect(staerkerer(vermutung, aussage)).toBe("b");
    expect(staerkerer(aussage, vermutung)).toBe("a");
  });

  it("stellt eine Bestätigung über eine blosse Aussage", () => {
    expect(
      staerkerer(beleg({ quelle: "user_confirmed" }), beleg({ quelle: "user_stated" })),
    ).toBe("a");
  });

  it("lässt innerhalb einer Stufe die Konfidenz entscheiden", () => {
    expect(
      staerkerer(
        beleg({ quelle: "user_stated", konfidenz: 0.9 }),
        beleg({ quelle: "user_stated", konfidenz: 0.5 }),
      ),
    ).toBe("a");
  });

  it("nennt zwei fast gleiche Aussagen gleichrangig", () => {
    /*
     * Welche gilt, ist dann eine Frage an die Person und nicht an
     * eine Zahl.
     */
    expect(
      staerkerer(
        beleg({ quelle: "user_stated", konfidenz: 0.85 }),
        beleg({ quelle: "user_stated", konfidenz: 0.8 }),
      ),
    ).toBe("gleichrangig");
  });
});

describe("Was eine Entscheidung tragen darf", () => {
  it("lässt eine Vermutung keine Karriereentscheidung tragen", () => {
    /*
     * Sie darf in einer Zusammenfassung stehen. Sie darf nicht der
     * Grund sein, warum jemandem ein Berufsweg empfohlen oder
     * verschwiegen wird.
     */
    expect(traegtEntscheidung(beleg({ quelle: "ai_hypothesis", konfidenz: 0.9 }))).toBe(false);
  });

  it("lässt eine klare Aussage sie tragen", () => {
    expect(traegtEntscheidung(beleg({ quelle: "user_stated", konfidenz: 0.9 }))).toBe(true);
  });

  it("lässt ein schwaches Signal sie nicht tragen", () => {
    expect(traegtEntscheidung(beleg({ quelle: "external_source", konfidenz: 0.4 }))).toBe(false);
  });
});

describe("Die Bänder", () => {
  it("benennt sie wie im Auftrag", () => {
    expect(konfidenzband(0.97)).toBe("sicher");
    expect(konfidenzband(0.8)).toBe("stark");
    expect(konfidenzband(0.6)).toBe("plausibel");
    expect(konfidenzband(0.3)).toBe("schwach");
  });
});
