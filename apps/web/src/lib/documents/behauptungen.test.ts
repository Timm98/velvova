import { describe, expect, it } from "vitest";
import { behauptungenAusText } from "./behauptungen.ts";

/**
 * Was aus einem Lebenslauf über einen Menschen folgen darf.
 *
 * Der schlimmste denkbare Fehler in diesem Produkt wäre eine erfundene
 * Station im Profil einer realen Person — etwas, das sie später in
 * einem Vorstellungsgespräch verteidigen müsste. Deshalb prüft diese
 * Datei vor allem, dass NICHTS entsteht, was nicht im Text steht.
 */

const LEBENSLAUF = `
Lebenslauf

Berufserfahrung
03/2019 – 2022   Disposition, Müller Logistik GmbH
Aufgaben: Tourenplanung, Kundenkontakt, Reklamationsbearbeitung.
2022 bis heute   Sachbearbeitung, Beispiel AG

Ausbildung
Ausbildung zum Kaufmann für Spedition und Logistikdienstleistung

Kenntnisse
Excel sicher, SAP Grundkenntnisse
Deutsch Muttersprache, Englisch B2
Führerschein Klasse B
`;

describe("Fundstellen", () => {
  it("findet Zeiträume", () => {
    const b = behauptungenAusText(LEBENSLAUF).filter((x) => x.art === "period");
    expect(b.length).toBeGreaterThanOrEqual(2);
    expect(b.some((x) => x.aussage.includes("2019"))).toBe(true);
  });

  it("findet Arbeitgeber an ihrer Rechtsform", () => {
    const b = behauptungenAusText(LEBENSLAUF).filter((x) => x.art === "employer");
    const namen = b.map((x) => x.aussage).join(" | ");
    expect(namen).toMatch(/Müller Logistik GmbH/);
    expect(namen).toMatch(/Beispiel AG/);
  });

  it("findet Abschlüsse, Sprachen und Berechtigungen", () => {
    const alle = behauptungenAusText(LEBENSLAUF);
    const text = alle.map((x) => x.aussage).join(" | ");
    expect(text).toMatch(/Ausbildung zum Kaufmann/i);
    expect(text).toMatch(/Englisch B2/);
    expect(text).toMatch(/Führerschein Klasse B/);
  });

  it("findet nur Werkzeuge, die namentlich dastehen", () => {
    const werkzeuge = behauptungenAusText(LEBENSLAUF)
      .filter((x) => x.art === "tool")
      .map((x) => x.aussage);
    expect(werkzeuge).toContain("Excel");
    expect(werkzeuge).toContain("SAP");
    // Nirgends erwähnt — darf also nicht auftauchen.
    expect(werkzeuge).not.toContain("Photoshop");
    expect(werkzeuge).not.toContain("Python");
  });
});

describe("Nichts erfinden", () => {
  it("gibt bei einem leeren Text nichts zurück", () => {
    expect(behauptungenAusText("")).toEqual([]);
    expect(behauptungenAusText("Hallo. Wie geht es dir?")).toEqual([]);
  });

  it("belegt jede Behauptung mit einer Stelle im Text", () => {
    /*
     * Die Zusage, auf der alles beruht.
     *
     * Zu jeder Behauptung muss sich die Person die Stelle im eigenen
     * Dokument ansehen können. Eine Behauptung ohne prüfbare Fundstelle
     * ist von einer Erfindung nicht zu unterscheiden.
     */
    for (const b of behauptungenAusText(LEBENSLAUF)) {
      expect(b.von, b.aussage).toBeGreaterThanOrEqual(0);
      expect(b.bis, b.aussage).toBeGreaterThan(b.von);
      expect(b.bis, b.aussage).toBeLessThanOrEqual(LEBENSLAUF.length);
      expect(b.zitat.length, b.aussage).toBeGreaterThan(0);
      // Das Zitat muss wirklich aus dem Text stammen.
      const ausschnitt = LEBENSLAUF.slice(b.von, b.bis).replace(/\s+/g, " ").trim();
      expect(b.zitat.replace(/\s+/g, " ")).toContain(ausschnitt);
    }
  });

  it("trifft ein Werkzeug nicht mitten in einem anderen Wort", () => {
    // „R" ist ein Werkzeug in der Liste. In „Reklamation" darf es nicht
    // treffen — sonst stünde im Profil eine Programmiersprache, die
    // niemand erwähnt hat.
    const werkzeuge = behauptungenAusText("Reklamationsbearbeitung und Routenplanung")
      .filter((x) => x.art === "tool")
      .map((x) => x.aussage);
    expect(werkzeuge).not.toContain("R");
  });

  it("nennt nichts zweimal", () => {
    const doppelt = behauptungenAusText(`${LEBENSLAUF}\n${LEBENSLAUF}`);
    const schluessel = doppelt.map((b) => `${b.art}|${b.aussage.toLowerCase()}`);
    expect(new Set(schluessel).size).toBe(schluessel.length);
  });

  it("bleibt auch bei einem langen Dokument beherrschbar", () => {
    const lang = LEBENSLAUF.repeat(40);
    expect(behauptungenAusText(lang).length).toBeLessThanOrEqual(40);
  });

  it("liefert bei zweimaligem Aufruf dasselbe", () => {
    /*
     * Globale reguläre Ausdrücke merken sich ihre Position. Ohne
     * Zurücksetzen fände der zweite Aufruf weniger als der erste — ein
     * Fehler, den man erst beim zweiten hochgeladenen Dokument sieht.
     */
    const a = behauptungenAusText(LEBENSLAUF);
    const b = behauptungenAusText(LEBENSLAUF);
    expect(b.map((x) => x.aussage)).toEqual(a.map((x) => x.aussage));
  });
});
