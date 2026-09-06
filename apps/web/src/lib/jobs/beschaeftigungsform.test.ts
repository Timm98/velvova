import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KEIN_VOLLZEITVERGLEICH } from "./beschaeftigungsform.ts";

/**
 * Dieselbe Sperre steht an zwei Orten — und muss dieselbe bleiben.
 *
 * Die Weboberfläche entscheidet damit, ob eine Stelle eine
 * Vollzeitspanne angezeigt bekommt. Der Worker entscheidet damit, ob
 * er einen Titel überhaupt einem Beruf zuordnet.
 *
 * Driften die beiden auseinander, entsteht der unangenehmste Fehler
 * dieser Art: Der Worker ordnet „Werkstudent Vertrieb" zu, die
 * Oberfläche zeigt die Zuordnung an — und niemand sieht, an welcher
 * der beiden Stellen die Regel fehlte. Dieser Test hält sie zusammen.
 */

const WORKER = "../../../../worker/src/tasks/entgeltreferenz.ts";

function regexAusDatei(pfad: string): string {
  const quelle = readFileSync(new URL(pfad, import.meta.url), "utf8");
  const treffer = /const KEIN_VOLLZEITVERGLEICH =\s*(\/[\s\S]*?\/[a-z]*);/.exec(quelle);
  if (!treffer) throw new Error(`Keine Sperre gefunden in ${pfad}`);
  return treffer[1]!;
}

describe("Die Sperre gilt überall gleich", () => {
  it("steht im Worker wortgleich wie in der Oberfläche", () => {
    expect(regexAusDatei(WORKER)).toBe(KEIN_VOLLZEITVERGLEICH.toString());
  });
});

describe("Was sie fängt", () => {
  it("erkennt die verbreiteten Formen", () => {
    for (const t of [
      "Werkstudent Vertrieb (m/w/d)",
      "Praktikum im Marketing",
      "Praktikant Controlling",
      "Ausbildung zum Kaufmann",
      "Azubi Lagerlogistik",
      "Duales Studium BWL",
      "Trainee Programm Finance",
      "Aushilfe Verkauf",
      "Minijob Reinigung",
      "Werkstudierende Data Science",
      "Masterarbeit Maschinenbau",
      "Ferienjob Lager",
      // Der Bestand ist zweisprachig, die erste Fassung der Sperre
      // war es nicht: 54 Stellen rutschten durch, die meisten davon
      // heissen „Working Student".
      "Working Student - B2B Sales (m/w/d)",
      "Revenue Operations Working Student",
      "Performance Marketing Working Student (f/m/d)",
      // Und `\\bpraktik` greift nicht in der Wortmitte.
      "Pflichtpraktikum im Bereich Grafikdesign (m/w/d)",
      "Pflichtpraktikant Mandantenbetreuung (x/w/m)",
      "UX Designer:in - Werkstudium oder Pflichtpraktikum",
      "InnoMaster Softwareentwicklung (berufsbegleitendes Masterstudium)",
      "Traineeship Public Relations (m/w/d)",
    ]) {
      expect(KEIN_VOLLZEITVERGLEICH.test(t), t).toBe(true);
    }
  });

  it("lässt gewöhnliche Vollzeitstellen durch", () => {
    /*
     * Die andere Fehlerrichtung.
     *
     * Eine zu gierige Sperre nimmt Tausenden regulärer Stellen die
     * Gehaltsangabe weg — und das fällt niemandem auf, weil ein
     * fehlender Wert wie fehlende Daten aussieht.
     */
    for (const t of [
      "Softwareentwickler (m/w/d)",
      "Buchhalter in Teilzeit",
      "Interner Revisor",
      "Meister Elektrotechnik",
      "Praxisanleiter Pflege",
      "Masterplaner Logistik",
      "Sachbearbeiter Auftragsabwicklung",
      // `master` ohne Kontext fing echte Vollzeitstellen. Diese drei
      // sind der Grund, warum dort jetzt der Studienbezug steht.
      "Masterplaner Logistik",
      "Scrum Master (m/w/d)",
      "Master Data Specialist",
      // Und eine Verwaltungsstelle, die Ausbildung fördert, ist keine
      // Ausbildungsstelle.
      "Sachbearbeitung Ausbildungsförderung (m/w/d)",
    ]) {
      expect(KEIN_VOLLZEITVERGLEICH.test(t), t).toBe(false);
    }
  });
});
