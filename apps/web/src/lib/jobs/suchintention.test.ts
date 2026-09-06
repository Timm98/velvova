import { describe, expect, it } from "vitest";
import { deuteSuchintention, erklärung } from "./suchintention.ts";

/**
 * Die vier Beispielsätze aus der Oberfläche sind der Kern dieser Datei.
 *
 * Sie stehen als Vorschläge unter dem Suchfeld — wer sie anklickt,
 * erwartet ein Ergebnis. Vorher bekam er eine leere Liste, weil jedes
 * Wort im Jobtitel vorkommen musste. Genau diese Sätze müssen also
 * funktionieren, und zwar nachweislich.
 */

describe("Suchintention", () => {
  it("versteht „Maximal zwei Bürotage rund um Karlsruhe“", () => {
    const i = deuteSuchintention("Maximal zwei Bürotage rund um Karlsruhe.");
    expect(i.filter.remote).toBe("hybrid");
    expect(i.filter.ort).toBe("Karlsruhe");
    // Und vor allem: nichts davon landet mehr im Volltext.
    expect(i.filter.q, "der ganze Satz geht in Filtern auf").toBeUndefined();
  });

  it("versteht „Nur Stellen ab 45.000 €, wenn das Gehalt angegeben ist.“", () => {
    const i = deuteSuchintention("Nur Stellen ab 45.000 €, wenn das Gehalt angegeben ist.");
    expect(i.filter.gehaltAb).toBe(45_000);
    expect(
      i.filter.salary,
      "ohne Gehaltsangabe wäre ein Mindestgehalt eine stille Ausschlussliste",
    ).toBe("disclosed");
  });

  it("versteht „Jobs mit Kundenkontakt, aber ohne Kaltakquise.“", () => {
    const i = deuteSuchintention("Jobs mit Kundenkontakt, aber ohne Kaltakquise.");
    // Hier gibt es nichts strukturiert zu holen — und das ist richtig.
    // Der Rest bleibt Volltext, aber ohne die Füllwörter, an denen der
    // UND-Vergleich vorher scheiterte.
    expect(i.filter.q).toContain("kundenkontakt");
    expect(i.filter.q).not.toContain("jobs");
    expect(i.filter.q).not.toContain("aber");
  });

  it("rechnet Gehälter in allen üblichen Schreibweisen um", () => {
    for (const [text, erwartet] of [
      ["ab 45.000 €", 45_000],
      ["ab 45000", 45_000],
      ["ab 45k", 45_000],
      ["mindestens 60.000 Euro", 60_000],
      ["ab 52", 52_000],
    ] as const) {
      expect(deuteSuchintention(text).filter.gehaltAb, text).toBe(erwartet);
    }
  });

  it("macht aus null Bürotagen remote und aus zweien hybrid", () => {
    expect(deuteSuchintention("keine Bürotage").filter.remote).toBe("remote");
    expect(deuteSuchintention("maximal 2 Bürotage").filter.remote).toBe("hybrid");
  });

  it("erfindet keinen Filter, wenn die Angabe nicht abbildbar ist", () => {
    /*
     * Vier Bürotage lassen sich mit „remote | hybrid | vor Ort" nicht
     * ausdrücken. Dann lieber gar kein Filter als ein falscher: „vier
     * Tage" auf „vor Ort" zu runden hiesse, eine Bedingung zu
     * verschärfen, die niemand gestellt hat.
     */
    const i = deuteSuchintention("vier Bürotage");
    expect(i.filter.remote).toBeUndefined();
  });

  it("liest den Ort nicht aus einem Arbeitsmodell", () => {
    // „remote in Berlin“ darf nicht „remote“ als Ort verstehen.
    const i = deuteSuchintention("remote in Berlin");
    expect(i.filter.remote).toBe("remote");
    expect(i.filter.ort).toBe("Berlin");
  });

  it("erkennt Vertragsart und Aktualität", () => {
    const i = deuteSuchintention("unbefristete Stellen aus den letzten 3 Tagen");
    expect(i.filter.contract).toBe("permanent");
    expect(i.filter.since).toBe(3);
  });

  it("setzt bei leerer Eingabe nichts", () => {
    const i = deuteSuchintention("   ");
    expect(i.filter).toEqual({});
    expect(i.erkannt).toEqual([]);
  });

  it("formuliert eine Erklärung ohne Fachbegriffe", () => {
    const i = deuteSuchintention("Maximal zwei Bürotage rund um Karlsruhe.");
    const satz = erklärung(i)!;
    expect(satz).toContain("höchstens 2 Bürotage");
    expect(satz).toContain("Karlsruhe");
    // Keine Feldnamen, keine Codewerte.
    expect(satz).not.toMatch(/workModel|hybrid|remote=|filter/i);
  });

  it("schweigt, wenn es nichts zu erklären gibt", () => {
    expect(erklärung(deuteSuchintention("irgendwas beliebiges"))).toBeNull();
  });
});

describe("Rest nach dem Deuten", () => {
  it("lässt keine verstandenen Wörter im Volltext zurück", () => {
    /*
     * Der Fehler, der die Liste leerte, obwohl alles verstanden wurde.
     *
     * Der Betrag setzt `salary=disclosed` gleich mit; die spätere
     * Gehaltsregel ist dann überflüssig. Liess sie ihre Wörter stehen,
     * entstand `q=gehalt angegeben` — ein Volltextfilter auf Wörter,
     * die in keiner Stellenanzeige vorkommen.
     */
    const i = deuteSuchintention("Nur Stellen ab 45.000 €, wenn das Gehalt angegeben ist.");
    expect(i.filter.gehaltAb).toBe(45_000);
    expect(i.filter.salary).toBe("disclosed");
    expect(i.filter.q, `Rest war: ${i.filter.q ?? "(leer)"}`).toBeUndefined();
  });

  it("nennt eine Bedingung nur einmal", () => {
    const i = deuteSuchintention("remote, am liebsten komplett remote");
    expect(i.erkannt.filter((e) => e.includes("remote")).length).toBe(1);
  });
});

describe("Ausschlüsse", () => {
  it("dreht „ohne X“ nicht in eine Forderung nach X um", () => {
    const i = deuteSuchintention("Jobs mit Kundenkontakt, aber ohne Kaltakquise.");
    expect(i.filter.nicht, "Kaltakquise muss ausgeschlossen sein").toContain("kaltakquise");
    expect(i.filter.q ?? "", "und darf nicht zugleich gefordert werden").not.toContain("kaltakquise");
    expect(i.filter.q).toContain("kundenkontakt");
  });

  it("erklärt den Ausschluss in Worten", () => {
    const satz = erklärung(deuteSuchintention("ohne Schichtdienst"))!;
    expect(satz).toContain("ohne schichtdienst");
  });
});

describe("Die Fahrzeit", () => {
  it("versteht „keine längere Autofahrt als 170 min“", () => {
    /*
     * Der Fall, der die Liste geleert hat: Der ganze Satz wanderte in
     * die Volltextsuche und fand Anzeigen, in denen „längere",
     * „autofahrt" und „als" vorkommen — also keine.
     */
    const r = deuteSuchintention("keine längere autofahrt als 170 min");
    expect(r.filter.pendelzeit).toBe(170);
    expect(r.filter.q).toBeUndefined();
  });

  it("versteht die üblichen Formulierungen", () => {
    expect(deuteSuchintention("höchstens 45 minuten fahrt").filter.pendelzeit).toBe(45);
    expect(deuteSuchintention("max 30 min pendeln").filter.pendelzeit).toBe(30);
  });

  it("verwechselt Minuten nicht mit Kilometern", () => {
    const km = deuteSuchintention("25 km um karlsruhe");
    expect(km.filter.umkreisKm).toBe(25);
    expect(km.filter.pendelzeit).toBeUndefined();
  });

  it("erfindet keine Grenze, wenn keine Zahl dasteht", () => {
    /* „Keine lange Anfahrt" nennt keine Zahl. Eine zu setzen wäre
       eine Grenze, die niemand genannt hat — der Satz wird nur
       aufgebraucht, damit er nicht zum Suchwort wird. */
    const r = deuteSuchintention("keine lange anfahrt");
    expect(r.filter.pendelzeit).toBeUndefined();
    expect(r.filter.q).toBeUndefined();
  });
});
