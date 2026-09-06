import { describe, expect, it } from "vitest";
import {
  bandAusScore,
  befundAusPruefung,
  befundAusSicherheit,
  BEFUNDTON,
  type Befund,
} from "./befundton.ts";

/**
 * Rot ist eine Aussage, kein Farbwert.
 *
 * Es heisst „hier stimmt etwas nicht". Wenn es stattdessen „wir wissen
 * noch nichts" heisst, beschuldigt die Oberfläche eine Stelle für eine
 * Lücke auf unserer Seite — und das bei fast jeder Zeile einer frischen
 * Trefferliste.
 */

const ALLE: Befund[] = ["positiv", "teilweise", "offen", "konflikt"];

describe("Nur der Konflikt ist rot", () => {
  it("färbt ausschliesslich den Konflikt kritisch", () => {
    for (const b of ALLE) {
      const kritisch = BEFUNDTON[b].text.includes("critical") || BEFUNDTON[b].fuellung.includes("critical");
      expect(kritisch, b).toBe(b === "konflikt");
    }
  });

  it("gibt jedem Zustand ein eigenes Zeichen", () => {
    /*
     * Farbe allein reicht nicht. Rund acht Prozent der Männer
     * unterscheiden Rot und Grün nicht zuverlässig — und auf einer Liste
     * aus Punkten wäre die Farbe die einzige Information.
     */
    const zeichen = ALLE.map((b) => BEFUNDTON[b].zeichen);
    expect(new Set(zeichen).size).toBe(ALLE.length);
  });

  it("hat für jeden Zustand ein Wort", () => {
    for (const b of ALLE) expect(BEFUNDTON[b].wort.length, b).toBeGreaterThan(2);
  });
});

describe("Fehlende Angaben sind offen, nicht schlecht", () => {
  it("macht aus einer ungeprüften Bedingung „offen“", () => {
    expect(befundAusPruefung("uncertain")).toBe("offen");
    expect(befundAusPruefung("unknown")).toBe("offen");
    expect(befundAusPruefung("")).toBe("offen");
  });

  it("macht nur aus einem belegten Widerspruch einen Konflikt", () => {
    /*
     * Der einzige Weg zu Rot.
     *
     * „Du willst remote, die Anzeige sagt ausdrücklich vor Ort" ist ein
     * Konflikt. „Die Anzeige sagt nichts zum Arbeitsmodell" ist keiner.
     */
    expect(befundAusPruefung("blocked")).toBe("konflikt");
    expect(befundAusPruefung("eligible")).toBe("positiv");
  });

  it("kommt von der Sicherheit aus NIE zu Rot", () => {
    /*
     * Die wichtigste Zeile dieser Datei.
     *
     * Niedrige Sicherheit hiess bisher `bg-critical`. Auf einer frischen
     * Trefferliste war damit jede Zeile rot markiert — für eine Lücke im
     * eigenen Profil.
     */
    for (const l of ["high", "medium", "low"] as const) {
      expect(befundAusSicherheit(l), l).not.toBe("konflikt");
    }
    expect(befundAusSicherheit("low")).toBe("offen");
    expect(befundAusSicherheit("high")).toBe("positiv");
  });
});

describe("Das Band unter der Zahl", () => {
  it("nennt eine fehlende Passung „offen“ und nicht „schlecht“", () => {
    const b = bandAusScore(null);
    expect(b.befund).toBe("offen");
    expect(b.wort).toMatch(/offen/i);
    // Kein Minus, kein „nicht berechenbar", kein negatives Wort.
    expect(b.wort).not.toMatch(/nicht|kein|schlecht|niedrig/i);
  });

  it("kommt auch bei niedriger Passung nicht auf Rot", () => {
    // Eine niedrige Punktzahl bei dünner Datenlage ist kein Konflikt.
    expect(bandAusScore(10).befund).not.toBe("konflikt");
    expect(bandAusScore(0).befund).not.toBe("konflikt");
  });

  it("steigt mit der Passung", () => {
    expect(bandAusScore(85).befund).toBe("positiv");
    expect(bandAusScore(55).befund).toBe("teilweise");
    expect(bandAusScore(20).befund).toBe("offen");
  });
});
