import { describe, expect, it } from "vitest";
import { taetigkeit, type Taetigkeitslage } from "./taetigkeit.ts";

const ruhe: Taetigkeitslage = {
  busy: false,
  hoert: false,
  spricht: false,
  sucht: false,
  schreibtSchon: false,
};

describe("taetigkeit", () => {
  it("sagt nichts, wenn nichts läuft", () => {
    expect(taetigkeit(ruhe)).toBeNull();
  });

  it("denkt nach, sobald eine Anfrage läuft", () => {
    expect(taetigkeit({ ...ruhe, busy: true })).toBe("Denkt nach");
  });

  it("nennt die Stellensuche, wenn Monday sie angekündigt hat", () => {
    expect(taetigkeit({ ...ruhe, busy: true, sucht: true })).toBe("Sucht passende Stellen");
  });

  /*
   * Der Text selbst ist der bessere Beweis, dass etwas passiert.
   * Beides gleichzeitig zu zeigen wäre doppelt gemoppelt — und die
   * Zeile stünde unter einer Antwort, die schon läuft.
   */
  it("schweigt, sobald das erste Wort der Antwort steht", () => {
    expect(taetigkeit({ ...ruhe, busy: true, schreibtSchon: true })).toBeNull();
    expect(taetigkeit({ ...ruhe, busy: true, sucht: true, schreibtSchon: true })).toBeNull();
  });

  it("Zuhören schlägt alles", () => {
    expect(taetigkeit({ ...ruhe, busy: true, hoert: true, sucht: true })).toBe("Hört zu");
  });

  it("Vorlesen schlägt Denken", () => {
    expect(taetigkeit({ ...ruhe, busy: true, spricht: true })).toBe("Liest vor");
  });
});
