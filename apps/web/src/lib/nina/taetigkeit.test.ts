import { describe, expect, it } from "vitest";
import { taetigkeit, type Taetigkeitslage } from "./taetigkeit.ts";

const ruhe: Taetigkeitslage = {
  busy: false,
  hoert: false,
  spricht: false,
  sucht: false,
  schreibtSchon: false,
  werkzeug: null,
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

  it("nennt, was das laufende Werkzeug tut", () => {
    expect(taetigkeit({ ...ruhe, busy: true, werkzeug: "Stellen werden durchsucht" })).toBe(
      "Stellen werden durchsucht",
    );
  });

  /*
   * „Denkt nach" ist wahr und sagt wenig. Der Satz des Werkzeugs sagt,
   * WORAN — und genau das trennt eine Seite, die arbeitet, von einer,
   * die hängt.
   */
  it("das Werkzeug schlägt das allgemeine Nachdenken", () => {
    expect(
      taetigkeit({ ...ruhe, busy: true, sucht: true, werkzeug: "Passung wird berechnet" }),
    ).toBe("Passung wird berechnet");
  });

  it("aber der fertige Text schlägt auch das Werkzeug", () => {
    expect(
      taetigkeit({ ...ruhe, busy: true, werkzeug: "Profil wird ergänzt", schreibtSchon: true }),
    ).toBeNull();
  });

  it("Vorlesen schlägt Denken", () => {
    expect(taetigkeit({ ...ruhe, busy: true, spricht: true })).toBe("Liest vor");
  });
});
