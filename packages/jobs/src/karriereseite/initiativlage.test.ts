import { describe, expect, it } from "vitest";
import { fremdinhalt } from "./fremdinhalt.ts";
import { initiativlageLesen, kontaktkanaeleAusSeite } from "./initiativlage.ts";

const lage = (text: string) =>
  initiativlageLesen(fremdinhalt("https://landkreis.example/karriere", text));

describe("Die Verneinung ist der ganze Punkt", () => {
  it("liest eine ausdrückliche Ablehnung als Ablehnung", () => {
    /*
     * Ein Suchen nach dem Wort „Initiativbewerbung" findet diese Seite
     * genauso wie eine einladende — und bewertet beide gleich. Das ist
     * kein Randfall: Wer sie nicht will, schreibt es hin, mit demselben
     * Wort.
     */
    const b = lage("Initiativbewerbungen können leider nicht berücksichtigt werden.");
    expect(b.lage).toBe("ausgeschlossen");
    expect(b.belegsaetze[0]).toContain("nicht berücksichtigt");
  });

  it("liest eine Bitte als Bitte, nicht als Verbot", () => {
    const b = lage("Wir bitten, von Initiativbewerbungen abzusehen.");
    expect(b.lage).toBe("unerwuenscht");
  });

  it("lässt die Ablehnung im selben Satz die Einladung schlagen", () => {
    /*
     * "Wir freuen uns über Ihre Bewerbung, Initiativbewerbungen können
     * wir jedoch nicht berücksichtigen" ist ein Nein. Wer die Einladung
     * gewinnen liesse, läse das Gegenteil.
     */
    const b = lage(
      "Wir freuen uns über Ihre Bewerbung, Initiativbewerbungen können wir jedoch nicht berücksichtigen.",
    );
    expect(b.lage).toBe("ausgeschlossen");
  });

  it("lässt ein Verbot irgendwo auf der Seite gewinnen", () => {
    /*
     * Absichtlich zu vorsichtig. Der eine Fehler kostet einen
     * Arbeitgeber, der sich gefreut hätte. Der andere schreibt
     * jemanden an, der nein gesagt hat — und den bekommt man nicht
     * zurück.
     */
    const b = lage(
      [
        "Wir freuen uns jederzeit über Ihre Initiativbewerbung.",
        "Für Ausbildungsplätze können wir keine Initiativbewerbungen berücksichtigen.",
      ].join("\n"),
    );
    expect(b.lage).toBe("ausgeschlossen");
  });

  it("erkennt das Nein in Aktiv- und Passivform", () => {
    /*
     * Beide stehen etwa gleich häufig auf deutschen Karriereseiten.
     * Nur die Passivform zu kennen liest die Hälfte als blosse Bitte.
     */
    for (const satz of [
      "Initiativbewerbungen werden nicht berücksichtigt.",
      "Initiativbewerbungen können wir nicht berücksichtigen.",
      "Wir können keine Initiativbewerbungen entgegennehmen.",
      "Eine Initiativbewerbung ist derzeit nicht vorgesehen.",
    ]) {
      expect(lage(satz).lage, satz).toBe("ausgeschlossen");
    }
  });

  it("versteht die englischen Formeln", () => {
    expect(lage("We do not accept unsolicited applications.").lage).toBe("ausgeschlossen");
    expect(lage("We welcome speculative applications at any time.").lage).toBe("erwuenscht");
  });
});

describe("Die Einladung", () => {
  it("erkennt die übliche Formel", () => {
    const b = lage("Wir freuen uns über Ihre Initiativbewerbung.");
    expect(b.lage).toBe("erwuenscht");
    expect(b.quelle).toBe("https://landkreis.example/karriere");
  });

  it("erkennt den Talentpool", () => {
    expect(lage("Nehmen Sie gerne in unseren Talentpool auf.").lage).toBe("erwuenscht");
  });

  it("gibt die Sätze wörtlich zurück, nicht zusammengefasst", () => {
    const satz = "Wir freuen uns jederzeit über Ihre Initiativbewerbung.";
    expect(lage(satz).belegsaetze).toContain(satz);
  });
});

describe("Unbekannt ist nicht unklar", () => {
  it("meldet unbekannt, wenn das Thema gar nicht vorkommt", () => {
    /*
     * Der Unterschied trägt eine Entscheidung: `unbekannt` verbietet
     * den Kontakt, `unklar` erlaubt eine vorsichtige Anfrage.
     */
    const b = lage("Unsere offenen Stellen finden Sie im Stellenportal.");
    expect(b.lage).toBe("unbekannt");
    expect(b.belegsaetze).toEqual([]);
  });

  it("meldet erlaubt bei einer blossen Überschrift über einem Formular", () => {
    /* Keine Einladung in Worten, aber ein Formular dafür einzurichten
       sagt genug. */
    expect(lage("Initiativbewerbung\nIhre Angaben").lage).toBe("erlaubt");
  });

  it("zieht zwei Listenpunkte nicht zusammen", () => {
    /*
     * Ohne den Zeilenumbruch als Satzende käme die Verneinung des
     * einen Punktes an die Einladung des anderen.
     */
    const b = lage("Offene Stellen\nInitiativbewerbungen sind nicht möglich");
    expect(b.lage).toBe("ausgeschlossen");
  });
});

describe("Kontaktwege — nur, was dasteht", () => {
  const SEITE = "https://landkreis.example/karriere";

  it("findet eine verlinkte Bewerbungsadresse und ordnet sie ein", () => {
    const k = kontaktkanaeleAusSeite(
      '<a href="mailto:bewerbung@landkreis.example">Bewerbung</a>',
      SEITE,
    );
    expect(k[0]?.art).toBe("recruitingadresse");
    expect(k[0]?.ziel).toBe("bewerbung@landkreis.example");
    /* Ohne Fundstelle wäre der Kanal geraten. */
    expect(k[0]?.belegUrl).toBe(SEITE);
  });

  it("findet eine Adresse auch im blossen Text", () => {
    const k = kontaktkanaeleAusSeite("<p>Fragen? personal@landkreis.example</p>", SEITE);
    expect(k[0]?.ziel).toBe("personal@landkreis.example");
  });

  it("erfindet keine Adresse nach einem Muster", () => {
    /*
     * `vorname.nachname@firma.de` ist eine wahrscheinliche Schreibweise
     * und keine Auskunft. Wer danach schreibt, schreibt an jemanden,
     * der nie gesagt hat, dass er erreichbar sein will.
     */
    const k = kontaktkanaeleAusSeite(
      "<p>Ansprechpartnerin: Frau Müller, Personalamt, Landratsamt</p>",
      SEITE,
    );
    expect(k).toEqual([]);
  });

  it("stellt das Initiativformular über jede Adresse", () => {
    const k = kontaktkanaeleAusSeite(
      [
        '<a href="mailto:info@landkreis.example">Kontakt</a>',
        '<a href="/karriere/initiativbewerbung">Initiativbewerbung senden</a>',
      ].join(""),
      SEITE,
    );
    expect(k[0]?.art).toBe("initiativformular");
    expect(k[0]?.ziel).toBe("https://landkreis.example/karriere/initiativbewerbung");
  });

  it("erkennt ein allgemeines Bewerbungsformular", () => {
    const k = kontaktkanaeleAusSeite('<a href="/apply">Jetzt bewerben</a>', SEITE);
    expect(k[0]?.art).toBe("karriereformular");
  });

  it("ordnet einen Namen als Ansprechpartner ein, ein Postfach nicht", () => {
    const k = kontaktkanaeleAusSeite(
      '<a href="mailto:anna.mueller@landkreis.example">Anna Müller</a>',
      SEITE,
    );
    expect(k[0]?.art).toBe("ansprechpartner");
  });

  it("verwirft Beispieladressen aus Vorlagen", () => {
    /* `name@example.com` steht in jedem zweiten Impressumsgenerator. */
    expect(
      kontaktkanaeleAusSeite("<p>name@example.com und info@muster.de</p>", SEITE),
    ).toEqual([]);
  });

  it("führt dieselbe Adresse nur einmal, mit der genaueren Einordnung", () => {
    const k = kontaktkanaeleAusSeite(
      [
        "<p>bewerbung@landkreis.example</p>",
        '<a href="mailto:bewerbung@landkreis.example">Bewerbung</a>',
      ].join(""),
      SEITE,
    );
    expect(k).toHaveLength(1);
    expect(k[0]?.art).toBe("recruitingadresse");
  });

  it("gibt eine leere Liste zurück, wenn kein Weg dasteht", () => {
    expect(kontaktkanaeleAusSeite("<p>Willkommen bei uns.</p>", SEITE)).toEqual([]);
  });
});
