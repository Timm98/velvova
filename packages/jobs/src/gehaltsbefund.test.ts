import { describe, expect, it } from "vitest";
import { alleGehaltsangaben, gehaltsbefund } from "./gehaltsbefund.ts";

/** Der Testfall aus dem Auftrag, wörtlich nachgebaut. */
const ANZEIGE = `
Wir bieten dir ein überdurchschnittliches Einkommen von 7.000 - 10.000 EUR pro Monat.
Das Grundgehalt liegt bei 3.000 - 7.000 EUR abhängig von Qualifikation und Leistung.
Dazu kommt eine attraktive Erfolgsbeteiligung von bis zu 2.000 EUR pro Monat.
`;

describe("Testfall aus dem Auftrag", () => {
  it("findet beide Spannen, nicht nur die erste", () => {
    /*
     * Der eigentliche Defekt: `gehaltAusText` gibt die erste Angabe
     * zurück. Damit entscheidet die Reihenfolge im Text darüber, was
     * jemand als sein Gehalt liest.
     */
    const a = alleGehaltsangaben(ANZEIGE);
    expect(a.some((x) => x.min === 7000 && x.max === 10000)).toBe(true);
    expect(a.some((x) => x.min === 3000 && x.max === 7000)).toBe(true);
  });

  it("meldet unterschiedliche Gehaltsangaben", () => {
    expect(gehaltsbefund(ANZEIGE).hinweise).toContain("Unterschiedliche Gehaltsangaben.");
  });

  it("meldet, dass kein Fixgehalt eindeutig zugesagt ist", () => {
    expect(gehaltsbefund(ANZEIGE).hinweise).toContain(
      "Garantiertes Fixgehalt nicht eindeutig angegeben.",
    );
  });

  it("nennt die Erfolgsbeteiligung als variabel", () => {
    const a = alleGehaltsangaben(ANZEIGE);
    expect(a.some((x) => x.art === "variabel")).toBe(true);
  });

  it("erklärt die Lage nicht für eindeutig", () => {
    expect(gehaltsbefund(ANZEIGE).eindeutig).toBe(false);
  });

  it("bildet keinen Mittelwert und erfindet keine neue Spanne", () => {
    /*
     * Die Versuchung wäre 3.000–10.000 oder 5.000. Beides stünde
     * nirgends und sähe aus wie eine Tatsache.
     */
    const a = alleGehaltsangaben(ANZEIGE);
    expect(a.some((x) => x.min === 3000 && x.max === 10000)).toBe(false);
    expect(a.some((x) => x.min === 5000)).toBe(false);
  });

  it("bevorzugt nicht stillschweigend den höchsten Betrag", () => {
    // Beide Spannen bleiben stehen, keine wird zur Hauptangabe erklärt.
    const a = alleGehaltsangaben(ANZEIGE);
    expect(a.length).toBeGreaterThanOrEqual(2);
  });

  it("hängt an jede Angabe ihre Textstelle", () => {
    for (const x of alleGehaltsangaben(ANZEIGE)) {
      expect(x.beleg.length).toBeGreaterThan(10);
    }
  });
});

describe("gehaltsbefund", () => {
  it("nennt eine einzelne zugesagte Angabe eindeutig", () => {
    const b = gehaltsbefund("Wir zahlen ein Fixgehalt von 55.000 EUR pro Jahr.");
    expect(b.eindeutig).toBe(true);
    expect(b.hinweise).toEqual([]);
  });

  it("hält eine zweimal genannte gleiche Spanne nicht für widersprüchlich", () => {
    /*
     * Eine Anzeige, die sich wiederholt, ist nicht widersprüchlich.
     * Verglichen wird über die Werte, nicht über die Fundstellen.
     */
    const b = gehaltsbefund(
      "Das Fixgehalt beträgt 50.000 - 60.000 EUR pro Jahr. Fixgehalt: 50.000 - 60.000 EUR pro Jahr.",
    );
    expect(b.hinweise).not.toContain("Unterschiedliche Gehaltsangaben.");
  });

  it("meldet fehlendes Gehalt als fehlend, nicht als Widerspruch", () => {
    const b = gehaltsbefund("Eine spannende Aufgabe in einem tollen Team erwartet dich.");
    expect(b.hinweise).toEqual(["Die Anzeige nennt kein Gehalt."]);
  });

  it("erkennt eine nur bedingte Angabe als nicht zugesagt", () => {
    const b = gehaltsbefund("Das Gehalt liegt bei 45.000 EUR je nach Erfahrung.");
    expect(b.hinweise).toContain("Garantiertes Fixgehalt nicht eindeutig angegeben.");
  });

  it("hält eine Jahreszahl nicht für ein Gehalt", () => {
    // „Seit 2019" enthält eine Zahl und ist kein Gehalt.
    expect(alleGehaltsangaben("Wir sind seit 2019 am Markt und haben 5000 Kunden.")).toEqual([]);
  });

  it("liest den Zeitraum aus der Umgebung", () => {
    const a = alleGehaltsangaben("Wir zahlen 25 EUR pro Stunde.");
    expect(a[0]?.zeitraum).toBe("hour");
  });

  it("behält eine Zahl ohne Zeitraum und markiert ihn als offen", () => {
    /*
     * Vorher galt ohne Angabe „Jahr", und 3.000 fiel als absurdes
     * Jahresgehalt durch die Plausibilitätsprüfung — die Angabe
     * verschwand also, weil wir etwas angenommen hatten.
     *
     * Jetzt bleibt sie stehen, mit `zeitraum: null`. Der Unterschied
     * zwischen 3.000 im Monat und im Jahr ist Faktor zwölf; ihn zu
     * raten wäre die teuerste Annahme in dieser Datei.
     */
    const a = alleGehaltsangaben("Wir bieten 3.000 EUR.");
    expect(a).toHaveLength(1);
    expect(a[0]?.zeitraum).toBeNull();
  });

  it("meldet den fehlenden Zeitraum als Hinweis", () => {
    expect(gehaltsbefund("Wir bieten 3.000 EUR.").hinweise).toContain(
      "Bei mindestens einer Angabe fehlt der Zeitraum.",
    );
  });
});
