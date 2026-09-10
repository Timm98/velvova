import { describe, expect, it } from "vitest";
import {
  type Quellenangabe,
  imGanzenGesperrt,
  quellePruefen,
  vorschauText,
} from "./quellenfreigabe.ts";

const gut: Quellenangabe = {
  art: "vorgangsliste",
  eigentuemer: "Leitung Kundenservice",
  zweck: "unternehmensanalyse",
  zeitraum: "Januar bis März 2026",
  alterTage: 20,
  sichtbarFuer: ["Leitung Kundenservice"],
  technischVerbunden: true,
  betrieblichBerechtigt: true,
  rechtsgrundlage: "berechtigtes Interesse, dokumentiert",
  aufVorgangsebene: true,
};

describe("Quellenarten, die nie im Ganzen ausgewertet werden", () => {
  it("sperrt Postfach, Mitarbeiterkommunikation, Kundendaten und Personalakte", () => {
    for (const a of ["postfach", "Mitarbeiterkommunikation", "KUNDENDATEN", "personalakte"]) {
      expect(imGanzenGesperrt(a)).toBe(true);
    }
  });

  it("sperrt sie auch dann, wenn sonst alles vorliegt", () => {
    const p = quellePruefen({ ...gut, art: "postfach" }, "unternehmensanalyse");
    expect(p.erlaubt).toBe(false);
  });
});

describe("Ein Zweck deckt keinen anderen", () => {
  it("weist die für den Bewerbungsversand verbundene Quelle für die Analyse ab", () => {
    const p = quellePruefen({ ...gut, zweck: "bewerbungsversand" }, "unternehmensanalyse");
    expect(p.erlaubt).toBe(false);
    if (!p.erlaubt) expect(p.grund).toMatch(/deckt keinen anderen/);
  });

  it("weist eine Quelle ohne hinterlegten Zweck ab", () => {
    expect(quellePruefen({ ...gut, zweck: null }, "unternehmensanalyse").erlaubt).toBe(false);
  });
});

describe("Verbindung, Berechtigung und Rechtsgrundlage sind drei Dinge", () => {
  it("verlangt jede einzeln", () => {
    expect(quellePruefen({ ...gut, technischVerbunden: false }, "unternehmensanalyse").erlaubt).toBe(false);
    expect(quellePruefen({ ...gut, betrieblichBerechtigt: false }, "unternehmensanalyse").erlaubt).toBe(false);
    expect(quellePruefen({ ...gut, rechtsgrundlage: null }, "unternehmensanalyse").erlaubt).toBe(false);
    expect(quellePruefen({ ...gut, rechtsgrundlage: "  " }, "unternehmensanalyse").erlaubt).toBe(false);
  });

  it("lässt die vollständige Quelle ohne Hinweis durch", () => {
    const p = quellePruefen(gut, "unternehmensanalyse");
    expect(p.erlaubt).toBe(true);
    if (p.erlaubt) expect(p.hinweise).toHaveLength(0);
  });
});

describe("Hinweise statt Sperre", () => {
  it("nennt fehlenden Zeitraum, hohes Alter und Personenebene", () => {
    const p = quellePruefen(
      { ...gut, zeitraum: null, alterTage: 800, aufVorgangsebene: false, sichtbarFuer: [] },
      "unternehmensanalyse",
    );
    expect(p.erlaubt).toBe(true);
    if (p.erlaubt) expect(p.hinweise).toHaveLength(4);
  });
});

describe("Die Vorschau vor dem Import", () => {
  it("beantwortet vier Fragen in fester Reihenfolge", () => {
    const z = vorschauText(gut, "unternehmensanalyse", 90);
    expect(z).toHaveLength(4);
    expect(z[0]).toMatch(/Verarbeitet wird/);
    expect(z[1]).toMatch(/Wofür/);
    expect(z[2]).toMatch(/Sichtbar für/);
    expect(z[3]).toMatch(/90 Tage/);
  });
});
