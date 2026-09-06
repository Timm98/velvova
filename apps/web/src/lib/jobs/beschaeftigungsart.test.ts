import { describe, expect, it } from "vitest";
import { beschaeftigungsart, BESCHAEFTIGUNGSARTEN } from "./beschaeftigungsart.ts";
import { KEIN_VOLLZEITVERGLEICH } from "./beschaeftigungsform.ts";

/**
 * Die Art einer Stelle — damit man sie auswählen kann.
 *
 * Zwei Fehlerrichtungen, und beide fallen niemandem auf:
 *
 *   **Zu grob.** Praktikum und Minijob in einem Topf heisst: Wer ein
 *   Praktikum sucht, bekommt Aushilfsstellen. Ein Filter, der nicht
 *   trennt, ist kein Filter.
 *
 *   **Zu gierig.** „Praxisanleiter" als Praktikum zu führen nimmt einer
 *   regulären Pflegestelle ihren Platz in der Hauptliste.
 */

describe("Die Formen auseinanderhalten", () => {
  it("erkennt jede Art an ihren üblichen Schreibweisen", () => {
    const proben: [string, string][] = [
      ["Werkstudent Vertrieb (m/w/d)", "werkstudium"],
      ["Working Student - B2B Sales", "werkstudium"],
      ["UX Designer:in - Werkstudium", "werkstudium"],
      ["Pflichtpraktikum Online Marketing", "praktikum"],
      ["Praktikant (m/w/d) Social Media", "praktikum"],
      ["Internship Data Science", "praktikum"],
      ["Masterarbeit Maschinenbau", "praktikum"],
      ["Ausbildung zum Kaufmann (m/w/d)", "ausbildung"],
      ["Azubi Lagerlogistik", "ausbildung"],
      ["Duales Studium BWL", "ausbildung"],
      ["Trainee Programm Finance", "trainee"],
      ["Traineeship Public Relations", "trainee"],
      ["Minijob Reinigung", "minijob"],
      ["Aushilfe Verkauf (m/w/d)", "minijob"],
      ["Ferienjob Lager", "minijob"],
      ["Softwareentwickler (m/w/d)", "regulaer"],
      ["Buchhalter in Teilzeit", "regulaer"],
    ];
    for (const [titel, erwartet] of proben) {
      expect(beschaeftigungsart(titel), titel).toBe(erwartet);
    }
  });

  it("entscheidet sich bei Mischformen für die spezifischere", () => {
    // „Werkstudent im Praktikumsprogramm" ist ein Werkstudium.
    expect(beschaeftigungsart("Werkstudent im Praktikumsprogramm")).toBe("werkstudium");
    expect(beschaeftigungsart("UX Designer:in - Werkstudium oder Pflichtpraktikum")).toBe(
      "werkstudium",
    );
  });

  it("hält reguläre Stellen aus den Sonderformen heraus", () => {
    /*
     * Die teurere Fehlerrichtung: Diese Titel enthalten Wortstämme der
     * Sonderformen und sind trotzdem gewöhnliche Vollzeitstellen.
     */
    for (const t of [
      "Praxisanleiter Pflege",
      "Masterplaner Logistik",
      "Scrum Master (m/w/d)",
      "Master Data Specialist",
      "Sachbearbeitung Ausbildungsförderung",
      "Interner Revisor",
      "Meister Elektrotechnik",
    ]) {
      expect(beschaeftigungsart(t), t).toBe("regulaer");
    }
  });
});

describe("Einteilung und Gehaltssperre bleiben einig", () => {
  it("führt keine Sonderform, die eine Vollzeitspanne bekäme", () => {
    /*
     * Die beiden Regelwerke stehen an verschiedenen Stellen und
     * beantworten verschiedene Fragen — aber sie dürfen sich nicht
     * widersprechen. Eine Stelle, die hier „Praktikum" heisst und
     * dort eine Vollzeitspanne bekommt, zeigt beides gleichzeitig an:
     * „Praktikum" und „54.000 €".
     */
    for (const t of [
      "Werkstudent Vertrieb (m/w/d)",
      "Working Student - B2B Sales",
      "Pflichtpraktikum Online Marketing",
      "Ausbildung zum Kaufmann (m/w/d)",
      "Trainee Programm Finance",
      "Minijob Reinigung",
      "Ferienjob Lager",
    ]) {
      expect(beschaeftigungsart(t), t).not.toBe("regulaer");
      expect(KEIN_VOLLZEITVERGLEICH.test(t), t).toBe(true);
    }
  });

  it("lässt umgekehrt nichts als regulär durchgehen, was gesperrt ist", () => {
    for (const t of ["Werkstudium Data Science", "Praktikant Controlling", "Azubi Verkauf"]) {
      expect(beschaeftigungsart(t), t).not.toBe("regulaer");
    }
  });

  it("kennt für jede Art einen Namen", async () => {
    const { ART_NAME, ART_HINWEIS } = await import("./beschaeftigungsart.ts");
    for (const a of BESCHAEFTIGUNGSARTEN) {
      expect(ART_NAME[a]?.length, a).toBeGreaterThan(0);
      expect(ART_HINWEIS[a]?.length, a).toBeGreaterThan(0);
    }
  });
});

describe("Was der Filter im echten Bestand findet", () => {
  /**
   * Der Grund, warum es diese Einteilung überhaupt gibt.
   *
   * Es gab schon Filteroptionen „Werkstudium" und „Praktikum" — sie
   * fragten `contract_type` ab. Gemessen am Bestand von 80.486
   * Stellen:
   *
   *   contract_type   | Titel
   *   ----------------|-------
   *   119 internship  | 1.069 Praktika
   *    99 working_st. |   816 Werkstudien
   *     5 apprentice. | 1.274 Ausbildungen
   *     — (kein Feld) |   516 Minijobs
   *
   * Der Filter fand rund ein Zehntel. Ein Filter, der ein Zehntel
   * findet, ist schlimmer als keiner: Er sieht aus wie eine
   * vollständige Antwort.
   */
  it("erkennt die Formen an Titeln, wie sie wirklich vorkommen", () => {
    // Echte Titel aus dem Bestand, keine ausgedachten.
    const echte: [string, string][] = [
      ["Werkstudent Vertrieb Grünstrom (m/w/d)", "werkstudium"],
      ["Werksstudent:in / Working Student Social Media", "werkstudium"],
      ["Revenue Operations Working Student", "werkstudium"],
      ["Pflichtpraktikant Mandantenbetreuung (x/w/m)", "praktikum"],
      ["Pflichtpraktikum Recruiting / Talent Acquisition (m/w/d)", "praktikum"],
      ["Ausbildungs-/ Studienplätze für den Studiengang Verwaltungsinformatik", "ausbildung"],
      ["InnoMaster Softwareentwicklung (berufsbegleitendes Masterstudium)", "ausbildung"],
      ["Traineeship Public Relations (m/w/d) ab 1. Januar 2027", "trainee"],
      ["Sachbearbeitung Ausbildungsförderung (m/w/d)", "regulaer"],
    ];
    for (const [titel, erwartet] of echte) {
      expect(beschaeftigungsart(titel), titel).toBe(erwartet);
    }
  });

  it("teilt jede Stelle genau einer Art zu", () => {
    // Keine Stelle darf durchfallen — „regulaer" ist der Auffang.
    for (const t of ["", "   ", "Irgendwas", "Senior Engineer"]) {
      expect(BESCHAEFTIGUNGSARTEN).toContain(beschaeftigungsart(t));
    }
  });
});
