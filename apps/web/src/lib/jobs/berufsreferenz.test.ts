import { describe, expect, it } from "vitest";
import {
  abfragestufen,
  berufAufloesen,
  haeufigsterBeruf,
  referenzFuerTitel,
  titelNormalisieren,
} from "./berufsreferenz.ts";

/**
 * Zwei Entscheidungen, die man ohne Netz prüfen kann und muss.
 *
 * Die Normalisierung bestimmt, wie oft der Zwischenspeicher trifft und
 * wie gut die Suchanfrage wird. Die Eindeutigkeitsregel bestimmt, ob
 * eine Stelle die Gehaltsspanne eines fremden Berufs bekommt — der
 * teurere der beiden Fehler.
 */

describe("Titel auf den Kern bringen", () => {
  it("entfernt Geschlechtszusätze in ihren Schreibweisen", () => {
    for (const t of [
      "Disponent (m/w/d)",
      "Disponent m/w/d",
      "Disponent (w/m/d)",
      "Disponent/in",
      "Disponent*in",
      "Disponent:in",
      "Disponent (all genders)",
    ]) {
      expect(titelNormalisieren(t), t).toBe("disponent");
    }
  });

  it("wirft Standortanhängsel weg, aber nicht den Beruf", () => {
    expect(titelNormalisieren("Buchhalter – Karlsruhe")).toBe("buchhalter");
    expect(titelNormalisieren("Elektroniker für Betriebstechnik")).toBe(
      "elektroniker für betriebstechnik",
    );
  });

  it("macht aus Schreibvarianten denselben Schlüssel", () => {
    // Der Zwischenspeicher trifft nur, wenn er trifft. 2.092
    // verschiedene Titel bei 2.506 Stellen heisst: fast jeder Titel
    // ist ein Einzelstück, solange man ihn nicht normalisiert.
    const a = titelNormalisieren("Vertriebsinnendienst (m/w/d)");
    const b = titelNormalisieren("Vertriebsinnendienst m/w/d ");
    expect(a).toBe(b);
  });

  it("lässt einen zu kurzen Rest als zu kurz erkennbar", () => {
    expect(titelNormalisieren("(m/w/d)").length).toBeLessThan(3);
  });
});

describe("Wann eine Zuordnung eindeutig genug ist", () => {
  const viele = (beruf: string, n: number) => Array.from({ length: n }, () => ({ hauptberuf: beruf }));

  it("nimmt die klar häufigste Bezeichnung", () => {
    const r = haeufigsterBeruf([...viele("Buchhalter/in", 40), ...viele("Bilanzbuchhalter/in", 10)]);
    expect(r.beruf).toBe("Buchhalter/in");
    expect(r.treffer).toBe(40);
  });

  it("verwirft eine Bezeichnung, die nur Rauschen ist", () => {
    /*
     * Der teure Fehler.
     *
     * Kommt eine Bezeichnung unter hundert Treffern dreimal vor, ist
     * sie kein Berufsbild. Die Stelle bekäme die Gehaltsspanne eines
     * fremden Berufs — und die sähe genauso aus wie eine richtige.
     */
    const r = haeufigsterBeruf([
      ...viele("Sachbearbeiter/in", 3),
      ...Array.from({ length: 97 }, (_, i) => ({ hauptberuf: `Beruf ${i}` })),
    ]);
    expect(r.beruf).toBeNull();
  });

  it("verwirft „eins von zwei“ trotz hohem Anteil", () => {
    // Anteil allein genügt nicht: 50 % von zwei Treffern ist keine
    // Aussage über einen Arbeitsmarkt.
    expect(haeufigsterBeruf([{ hauptberuf: "Koch/Köchin" }, { hauptberuf: "Beikoch" }]).beruf).toBeNull();
  });

  it("verwirft eine leere Antwort", () => {
    expect(haeufigsterBeruf([]).beruf).toBeNull();
  });

  it("übergeht Treffer ohne Bezeichnung", () => {
    const r = haeufigsterBeruf([...viele("Erzieher/in", 20), ...Array.from({ length: 5 }, () => ({}))]);
    expect(r.beruf).toBe("Erzieher/in");
    expect(r.gesamt).toBe(25);
  });
});

describe("Von genau nach allgemein", () => {
  it("fängt mit dem vollständigen Titel an", () => {
    // Wer sofort kürzt, ordnet „IT-Systemadministrator" unter
    // „Fachkraft" ein. Die genaueste Anfrage kommt zuerst.
    expect(abfragestufen("Vertriebscontroller im Bankenumfeld")[0]).toBe(
      "vertriebscontroller im bankenumfeld",
    );
  });

  it("wirft ein Ortsanhängsel weg", () => {
    // Gemessen: „finanzbuchhalter - memmingen" fand fünf Anzeigen,
    // weil der Ort mitgesucht wurde.
    expect(abfragestufen("Finanzbuchhalter - Memmingen")).toContain("finanzbuchhalter");
  });

  it("wirft einen präpositionalen Zusatz weg", () => {
    expect(abfragestufen("Vertriebscontroller im Bankenumfeld")).toContain("vertriebscontroller");
  });

  it("wirft Stufenwörter weg", () => {
    // „Senior BI Developer" fand drei Treffer. Die Stufe gehört zur
    // Stelle, nicht zum Berufsbild.
    expect(abfragestufen("Senior BI Developer")).toContain("bi developer");
  });

  it("kürzt zuletzt auf zwei Wörter, aber nicht auf eins", () => {
    /*
     * Die Untergrenze.
     *
     * Weiter zu kürzen ergäbe „Ingenieur" für alles, was mit
     * Ingenieur beginnt — und das ist keine Berufsbezeichnung,
     * sondern eine Familie mit sehr verschiedenen Gehältern.
     */
    const s = abfragestufen("Berechnungsingenieur Strukturanalyse Fahrwerk");
    expect(s).toContain("berechnungsingenieur strukturanalyse");
    expect(s.every((x) => x.split(" ").length >= 2 || x === s[0])).toBe(true);
  });

  it("gibt bei einem einfachen Titel nur eine Stufe", () => {
    // Nichts zu kürzen heisst: eine Anfrage, nicht fünf.
    expect(abfragestufen("Disponent (m/w/d)")).toEqual(["disponent"]);
  });

  it("wiederholt keine Stufe", () => {
    for (const t of ["Buchhalter", "Senior Softwareentwickler", "Koch - Berlin"]) {
      const s = abfragestufen(t);
      expect(new Set(s).size, t).toBe(s.length);
    }
  });
});

describe("Was keine Vollzeitspanne bekommen darf", () => {
  it("löst Werkstudenten- und Praktikumstitel gar nicht erst auf", async () => {
    /*
     * Gemessen an echten Antworten der Jobbörse: „werkstudent im
     * verkauf mode und bekleidung" wird zu „Fachverkäufer/in -
     * Textilien", „werkstudent sales operations" zu „Sales-Manager/in".
     *
     * Die Auflösung gelingt also — und genau das ist gefährlich. Die
     * Stelle bekäme die Vollzeitspanne des Berufs, formatiert und mit
     * Quellenangabe, und läge um ein Vielfaches daneben.
     */
    for (const t of [
      "Werkstudent Sales Operations",
      "Praktikum Marketing (m/w/d)",
      "Ausbildung Kaufmann für Büromanagement",
      "Duales Studium Wirtschaftsinformatik",
    ]) {
      expect(await berufAufloesen(t), t).toBeNull();
      expect(await referenzFuerTitel(t), t).toBeNull();
    }
  });
});
