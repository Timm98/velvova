import { describe, expect, it } from "vitest";
import { type Klaerungskandidat, naechsterSchritt } from "./klaerungsrang.ts";

const wochenende: Klaerungskandidat = {
  schluessel: "freie-wochenenden",
  art: "muss_offen",
  frage: "Gehören Wochenenddienste zur Stelle?",
  entscheidungsrelevant: true,
};
const ort: Klaerungskandidat = {
  schluessel: "einsatzort",
  art: "vergleichsbasis",
  frage: "An welchem Ort wird gearbeitet?",
  entscheidungsrelevant: true,
};
const konflikt: Klaerungskandidat = {
  schluessel: "schicht",
  art: "muss_konflikt",
  frage: "Die Stelle ist Nachtschicht — willst du deine Bedingung ändern?",
  entscheidungsrelevant: true,
};
const kleiderfarbe: Klaerungskandidat = {
  schluessel: "kleiderfarbe",
  art: "vergleichsbasis",
  frage: "Welche Farbe hat die Arbeitskleidung?",
  entscheidungsrelevant: false,
};

describe("Klärungsrang", () => {
  it("schweigt bei einer vollständigen, passenden Anzeige (Prüffall B10)", () => {
    /*
     * Die unbequemste Anforderung von allen. Eine Warnung, die immer
     * kommt, ist keine Warnung mehr, sondern Hintergrundrauschen.
     */
    expect(naechsterSchritt([]).vorschlag).toBeNull();
  });

  it("erzeugt zu einer belanglosen Lücke keine Frage", () => {
    const s = naechsterSchritt([kleiderfarbe]);
    expect(s.vorschlag).toBeNull();
    expect(s.satz).toContain("an deiner Entscheidung nichts ändern");
  });

  it("stellt den bekannten Muss-Konflikt vor die offene Muss-Frage", () => {
    const s = naechsterSchritt([wochenende, konflikt, ort]);
    expect(s.vorschlag?.schluessel).toBe("schicht");
    expect(s.spaeter.map((k) => k.schluessel)).toEqual(["freie-wochenenden", "einsatzort"]);
  });

  it("stellt die offene Muss-Frage vor die Vergleichsbasis", () => {
    /*
     * Fehlen Arbeitsort und Wochenendregelung, entscheidet die feste
     * Regel — nicht ein Wichtigkeitswert, den niemand nachvollziehen
     * kann.
     */
    const s = naechsterSchritt([ort, wochenende]);
    expect(s.vorschlag?.schluessel).toBe("freie-wochenenden");
  });

  it("zeigt genau einen Vorschlag, nicht drei", () => {
    const s = naechsterSchritt([wochenende, ort]);
    expect(s.gleichrangig).toHaveLength(1);
  });

  it("lässt bei Gleichstand die Person wählen", () => {
    const zweiteMussFrage: Klaerungskandidat = { ...wochenende, schluessel: "urlaub", frage: "Wie viele Urlaubstage?" };
    const s = naechsterSchritt([wochenende, zweiteMussFrage]);
    expect(s.gleichrangig).toHaveLength(2);
    expect(s.satz).toContain("Womit möchtest du anfangen");
  });
});
