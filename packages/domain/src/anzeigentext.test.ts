import { describe, expect, it } from "vitest";
import { anzeigenblöcke, anzeigenklartext } from "./anzeigentext.ts";

describe("anzeigenblöcke", () => {
  it("nimmt die Sterne weg und behält das Wort", () => {
    /* Der Fall aus der Oberfläche: „**WHY DASH?**" stand roh da. */
    expect(anzeigenblöcke("**WHY DASH?**")).toEqual([
      { art: "absatz", text: "WHY DASH?" },
    ]);
  });

  it("erkennt Rauten-Überschriften", () => {
    expect(anzeigenblöcke("## Deine Aufgaben")).toEqual([
      { art: "ueberschrift", text: "Deine Aufgaben" },
    ]);
  });

  it("erkennt eine Überschrift am Doppelpunkt", () => {
    /* So schreiben Personalabteilungen — ohne diese Regel bliebe die
       Hälfte der Struktur unerkannt. */
    const b = anzeigenblöcke("Deine Aufgaben:\n- Kunden beraten");
    expect(b[0]).toEqual({ art: "ueberschrift", text: "Deine Aufgaben" });
    expect(b[1]).toEqual({ art: "punkt", text: "Kunden beraten" });
  });

  it("hält einen ganzen Satz mit Doppelpunkt für einen Absatz", () => {
    const lang = "Wir suchen dich für unser Team in Karlsruhe, und zwar für folgende Aufgaben:";
    expect(anzeigenblöcke(lang)[0]!.art).toBe("absatz");
  });

  it("erkennt Aufzählungszeichen aus Textverarbeitungen", () => {
    /* •, ✓ und → kommen häufiger vor als `-`. */
    const b = anzeigenblöcke("• Erstens\n✓ Zweitens\n→ Drittens\n1. Viertens");
    expect(b.map((x) => x.art)).toEqual(["punkt", "punkt", "punkt", "punkt"]);
    expect(b.map((x) => x.text)).toEqual(["Erstens", "Zweitens", "Drittens", "Viertens"]);
  });

  it("macht aus einem Link den Text ohne die Adresse", () => {
    expect(anzeigenklartext("Mehr unter [unserer Seite](https://example.invalid/x)")).toBe(
      "Mehr unter unserer Seite",
    );
  });

  it("entfernt HTML, ohne Sätze zusammenzukleben", () => {
    /*
     * `<br>` ist ein Umbruch, kein Nichts — sonst steht
     * „ErstensZweitens". Und es wird zur Absatzgrenze, nicht zur
     * Zeile: In HTML schreibt niemand versehentlich einen Umbruch,
     * während ein `\n` im Rohtext fast immer nur harter Satz ist.
     */
    expect(anzeigenblöcke("Erstens<br>Zweitens")).toEqual([
      { art: "absatz", text: "Erstens" },
      { art: "absatz", text: "Zweitens" },
    ]);
    expect(anzeigenblöcke("<ul><li>Eins</li><li>Zwei</li></ul>").map((b) => b.text)).toEqual([
      "Eins",
      "Zwei",
    ]);
  });

  it("löst HTML-Entitäten auf", () => {
    expect(anzeigenklartext("Sales &amp; Marketing")).toBe("Sales & Marketing");
  });

  it("lässt einen Stern in einem Wort stehen", () => {
    /* `m*w*d` ist keine Auszeichnung, sondern Teil des Titels. */
    expect(anzeigenklartext("Verkäufer m*w*d gesucht")).toContain("m*w*d");
  });

  it("fasst umbrochene Zeilen zu einem Absatz zusammen", () => {
    /* Anzeigen sind oft hart auf 80 Zeichen umbrochen. Jede Zeile als
       eigener Absatz sähe aus wie ein Gedicht. */
    expect(anzeigenblöcke("Wir sind ein Team\naus zwanzig Menschen.")).toEqual([
      { art: "absatz", text: "Wir sind ein Team aus zwanzig Menschen." },
    ]);
  });

  it("gibt bei leerem Text eine leere Liste zurück", () => {
    /* Ein Ergebnis, kein Fehler — die Oberfläche sagt dann, dass die
       Anzeige nichts beschreibt. */
    expect(anzeigenblöcke(null)).toEqual([]);
    expect(anzeigenblöcke("   \n\n  ")).toEqual([]);
  });

  it("überlebt eine Anzeige aus lauter Trennlinien", () => {
    expect(anzeigenblöcke("-----\n=====\n___")).toEqual([]);
  });
});
