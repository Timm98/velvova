import { describe, expect, it } from "vitest";
import { entscheide, type Fakt } from "./faktenregeln";

const fakt = (t: Partial<Fakt>): Fakt => ({
  schluessel: "mindestgehalt",
  wert: 70000,
  quelle: "gespraech",
  konfidenz: 80,
  bestaetigt: false,
  ...t,
});

describe("Der Fall aus der Vorgabe", () => {
  it("überschreibt eine bestätigte Bedingung nicht", () => {
    /*
     * Bestätigt: mindestens 70.000. Später im Gespräch: „60 wären
     * auch okay." Das ist eine Aussage über einen Ausnahmefall, keine
     * Änderung der Regel — und ohne Nachfrage nicht zu unterscheiden.
     */
    const e = entscheide(
      fakt({ wert: 70000, bestaetigt: true, quelle: "nutzer" }),
      fakt({ wert: 60000, konfidenz: 75 }),
    );
    expect(e.art).toBe("nachfragen");
  });

  it("nennt in der Frage beide Werte", () => {
    const e = entscheide(
      fakt({ wert: 70000, bestaetigt: true }),
      fakt({ wert: 60000, konfidenz: 75 }),
    );
    if (e.art !== "nachfragen") throw new Error("erwartet: nachfragen");
    expect(e.frage).toContain("70.000");
    expect(e.frage).toContain("60.000");
  });

  it("fragt bei einer schwachen Vermutung gar nicht erst", () => {
    const e = entscheide(
      fakt({ wert: 70000, bestaetigt: true }),
      fakt({ wert: 60000, konfidenz: 40, quelle: "nina_ableitung" }),
    );
    expect(e.art).toBe("verwerfen");
  });

  it("lässt den Menschen selbst ändern", () => {
    const e = entscheide(
      fakt({ wert: 70000, bestaetigt: true }),
      fakt({ wert: 60000, bestaetigt: true, quelle: "nutzer" }),
    );
    expect(e.art).toBe("ersetzen");
  });
});

describe("Erster Wert", () => {
  it("übernimmt, wenn nichts dasteht", () => {
    expect(entscheide(null, fakt({})).art).toBe("ersetzen");
  });

  it("übernimmt auch eine unsichere Ableitung, wenn nichts dasteht", () => {
    expect(entscheide(null, fakt({ konfidenz: 30, quelle: "nina_ableitung" })).art)
      .toBe("ersetzen");
  });
});

describe("Gleicher Wert", () => {
  it("ändert nichts", () => {
    expect(entscheide(fakt({}), fakt({})).art).toBe("verwerfen");
  });

  it("hebt eine Ableitung auf bestätigt, wenn der Mensch zustimmt", () => {
    const e = entscheide(fakt({ bestaetigt: false }), fakt({ bestaetigt: true }));
    expect(e.art).toBe("ersetzen");
  });
});

describe("Zwei unbestätigte Werte", () => {
  it("lässt Gesagtes über Geschlossenes gehen — auch bei niedrigerer Zahl", () => {
    /*
     * Die Konfidenz eines Modells misst seine eigene Sicherheit, nicht
     * die Nähe zur Wahrheit. Ein Satz aus dem Gespräch wiegt mehr als
     * ein Schluss aus Ablehnungen.
     */
    const e = entscheide(
      fakt({ wert: 65000, quelle: "nina_ableitung", konfidenz: 95 }),
      fakt({ wert: 70000, quelle: "gespraech", konfidenz: 55 }),
    );
    expect(e.art).toBe("ersetzen");
  });

  it("lässt eine Ableitung keine Aussage ersetzen", () => {
    const e = entscheide(
      fakt({ wert: 70000, quelle: "gespraech", konfidenz: 55 }),
      fakt({ wert: 65000, quelle: "nina_ableitung", konfidenz: 95 }),
    );
    expect(e.art).toBe("verwerfen");
  });

  it("nimmt bei gleicher Nähe die belastbarere Angabe", () => {
    expect(
      entscheide(
        fakt({ wert: 65000, quelle: "gespraech", konfidenz: 50 }),
        fakt({ wert: 70000, quelle: "gespraech", konfidenz: 80 }),
      ).art,
    ).toBe("ersetzen");
    expect(
      entscheide(
        fakt({ wert: 65000, quelle: "gespraech", konfidenz: 90 }),
        fakt({ wert: 70000, quelle: "gespraech", konfidenz: 50 }),
      ).art,
    ).toBe("verwerfen");
  });
});

describe("Was nie passieren darf", () => {
  it("verwirft niemals stillschweigend eine bestätigte Angabe", () => {
    for (const q of ["gespraech", "dokument", "feedback", "nina_ableitung"] as const) {
      for (const k of [10, 50, 61, 99]) {
        const e = entscheide(
          fakt({ wert: "A", bestaetigt: true }),
          fakt({ wert: "B", bestaetigt: false, quelle: q, konfidenz: k }),
        );
        expect(e.art).not.toBe("ersetzen");
      }
    }
  });
});
