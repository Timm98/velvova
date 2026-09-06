import { describe, expect, it } from "vitest";
import { ABLEHNUNGSGRUENDE, musterErkennen } from "./musterregeln";

/**
 * Die Kopplung zwischen Oberfläche und Mustererkennung.
 *
 * Beide lesen `ABLEHNUNGSGRUENDE`. Diese Tests halten fest, dass sie
 * es weiterhin tun — der Fehler, den sie verhindern, ist ein Grund,
 * den jemand anklicken kann und auf den Nina nie reagiert.
 */

const tag = (n: number) => new Date(2026, 8, n);

describe("ABLEHNUNGSGRUENDE", () => {
  it("gibt jedem Grund einen Knopftext und eine Frage", () => {
    for (const [schluessel, eintrag] of Object.entries(ABLEHNUNGSGRUENDE)) {
      expect(eintrag.label, schluessel).toBeTruthy();
      expect(eintrag.frage, schluessel).toBeTruthy();
    }
  });

  it("formuliert jede Frage als Frage", () => {
    for (const [schluessel, eintrag] of Object.entries(ABLEHNUNGSGRUENDE)) {
      expect(eintrag.frage.trim().endsWith("?"), schluessel).toBe(true);
    }
  });

  it("hält die Knopftexte kurz genug für eine Pille", () => {
    // Über etwa 30 Zeichen bricht die Zeile in der Seitenspalte um.
    for (const [schluessel, eintrag] of Object.entries(ABLEHNUNGSGRUENDE)) {
      expect(eintrag.label.length, schluessel).toBeLessThanOrEqual(30);
    }
  });

  it("erkennt zu jedem angebotenen Grund auch ein Muster", () => {
    /*
     * Der eigentliche Punkt dieser Datei. Ein Grund ohne Frage ist ein
     * Knopf, der nichts auslöst — die Person begründet ihre Ablehnung
     * fünfmal, und Nina schweigt.
     */
    for (const schluessel of Object.keys(ABLEHNUNGSGRUENDE)) {
      const fuenfmal = [1, 2, 3, 4, 5].map((n) => ({ grund: schluessel, erstelltAm: tag(n) }));
      expect(musterErkennen(fuenfmal)?.grund, schluessel).toBe(schluessel);
    }
  });

  it("kennt den Grund aus Fall D des Auftrags", () => {
    expect(ABLEHNUNGSGRUENDE.kundenkontakt).toBeDefined();
  });

  it("erkennt einen Grund nicht, den die Oberfläche nicht anbietet", () => {
    // Ein Grund aus einer alten Zeile darf keine Frage erfinden.
    const fremd = [1, 2, 3, 4, 5].map((n) => ({ grund: "parkplatz", erstelltAm: tag(n) }));
    expect(musterErkennen(fremd)).toBeNull();
  });
});
