import { describe, expect, it } from "vitest";
import {
  erreichbarkeit,
  istReglementiert,
  kurzscheinFuer,
  lohntSich,
  type Huerde,
} from "./bruecke.ts";

/**
 * Diese Datei entscheidet, welche Stellen einem Menschen als „kannst
 * du heute antreten" gezeigt werden. Ein falscher Eintrag kostet das
 * Vertrauen für alle richtigen — deshalb prüfen die meisten Tests,
 * wann NICHT gezeigt wird.
 */

const h = (text: string, art: Huerde["art"], schein?: Huerde["schein"]): Huerde => ({ text, art, schein });

describe("istReglementiert", () => {
  it("erkennt Heilberufe", () => {
    expect(istReglementiert("Approbation als Arzt erforderlich")).toBe(true);
    expect(istReglementiert("Abgeschlossenes Studium der Pharmazie, Apothekerin")).toBe(true);
    expect(istReglementiert("Ausbildung als Hebamme")).toBe(true);
  });

  it("erkennt die Einrichtungsleitung", () => {
    /*
     * Der Fehler, der diese Datei nötig gemacht hat: Der Messlauf
     * lieferte eine Einrichtungsleitung für 72.500 € als „mit
     * Einarbeitung erreichbar". In Deutschland verlangt sie eine
     * formale Weiterbildung — die Hürde stand nicht im
     * Anforderungstext, sondern im Gesetz.
     */
    expect(istReglementiert("Einrichtungsleitung für eine Pflegeeinrichtung")).toBe(true);
    expect(istReglementiert("Heimleitung (m/w/d)")).toBe(true);
  });

  it("erkennt Meisterpflicht und geschützte Bezeichnungen", () => {
    expect(istReglementiert("Meisterbrief im Elektrohandwerk")).toBe(true);
    expect(istReglementiert("staatlich anerkannte Erzieherin")).toBe(true);
    expect(istReglementiert("Volljurist mit zweitem Staatsexamen")).toBe(true);
  });

  it("hält gewöhnliche Anforderungen für nicht reglementiert", () => {
    expect(istReglementiert("Erfahrung mit MS Office")).toBe(false);
    expect(istReglementiert("Teamfähigkeit und Belastbarkeit")).toBe(false);
    expect(istReglementiert("Sachbearbeitung im Förderwesen")).toBe(false);
    expect(istReglementiert("")).toBe(false);
    expect(istReglementiert(null)).toBe(false);
  });
});

describe("kurzscheinFuer", () => {
  it("erkennt den Staplerschein", () => {
    /* Sechs Stellen im Messlauf scheiterten einzig daran. Zwei Tage,
       rund 300 € — eine Liste, die sie als unerreichbar führt,
       verschweigt die billigste Brücke überhaupt. */
    const s = kurzscheinFuer("Staplerführerschein erforderlich");
    expect(s?.name).toBe("Staplerschein");
    expect(s?.tage).toBe(2);
  });

  it("erkennt weitere kurze Nachweise", () => {
    expect(kurzscheinFuer("Belehrung nach §43 Infektionsschutzgesetz")?.tage).toBe(1);
    expect(kurzscheinFuer("Erweitertes Führungszeugnis")?.name).toBe("Führungszeugnis");
  });

  it("gibt null für alles andere", () => {
    expect(kurzscheinFuer("Abgeschlossenes Studium")).toBe(null);
    expect(kurzscheinFuer(null)).toBe(null);
  });
});

describe("erreichbarkeit", () => {
  it("sperrt eine Stelle mit gesetzlich geschütztem Titel", () => {
    /* Der Titel nennt die Qualifikation, der Text setzt sie voraus —
       eine Prüfung nur über die Anforderungen liesse sie durch. */
    const e = erreichbarkeit("Erzieher (m/w/d) für unsere Kita", []);
    expect(e.art).toBe("gesperrt");
    if (e.art === "gesperrt") expect(e.grund).toContain("Berufsbezeichnung");
  });

  it("sperrt bei gesetzlicher Hürde im Text", () => {
    const e = erreichbarkeit("Mitarbeiter Gesundheitswesen", [h("Approbation erforderlich", "gesetzlich")]);
    expect(e.art).toBe("gesperrt");
  });

  it("sperrt bei verlangtem Abschluss und nennt ihn", () => {
    const e = erreichbarkeit("Projektleitung", [h("Abgeschlossenes Ingenieurstudium", "abschluss")]);
    expect(e.art).toBe("gesperrt");
    if (e.art === "gesperrt") {
      expect(e.grund).toBe("verlangter Abschluss");
      expect(e.huerde).toContain("Ingenieurstudium");
    }
  });

  it("nennt bei jeder Sperre einen Grund", () => {
    /* Eine Stelle, die nicht erscheint, ist für den Menschen dasselbe
       wie eine, die es nicht gibt. Wer fragt, muss eine Antwort
       bekommen, die stimmt. */
    const faelle = [
      erreichbarkeit("Zahnarzt", []),
      erreichbarkeit("X", [h("Meisterbrief", "gesetzlich")]),
      erreichbarkeit("X", [h("Fünf Jahre Vertriebserfahrung", "erfahrung")]),
    ];
    for (const e of faelle) {
      expect(e.art).toBe("gesperrt");
      if (e.art === "gesperrt") {
        expect(e.grund.length).toBeGreaterThan(0);
        expect(e.huerde.length).toBeGreaterThan(0);
      }
    }
  });

  it("meldet einen Kurzschein samt Aufwand", () => {
    const e = erreichbarkeit("Lagerkoordination", [
      h("Staplerschein", "kurzschein", { muster: /x/, name: "Staplerschein", tage: 2 }),
      h("Sorgfalt", "einarbeitung"),
    ]);
    expect(e.art).toBe("kurzschein");
    if (e.art === "kurzschein") {
      expect(e.tage).toBe(2);
      expect(e.scheine[0]!.name).toBe("Staplerschein");
    }
  });

  it("sperrt, wenn zu viele Scheine zusammenkommen", () => {
    /* Wer fünf Kurse braucht, hat keine Brücke vor sich, sondern eine
       Ausbildung — das gehört nicht in eine Liste, die „heute
       antreten" verspricht. */
    const viele = Array.from({ length: 5 }, (_, i) =>
      h(`Schein ${i}`, "kurzschein", { muster: /x/, name: `Schein ${i}`, tage: 14 }),
    );
    expect(erreichbarkeit("Irgendwas", viele).art).toBe("gesperrt");
  });

  it("erkennt sofort erreichbar und mit Einarbeitung", () => {
    expect(erreichbarkeit("Betriebsassistenz", [h("MS Office", "erfuellt")]).art).toBe("sofort");
    expect(erreichbarkeit("Betriebsassistenz", [h("SAP-Modul", "einarbeitung")]).art).toBe("einarbeitung");
    expect(erreichbarkeit("Betriebsassistenz", []).art).toBe("sofort");
  });

  it("urteilt nach der schwersten Hürde, nicht nach der häufigsten", () => {
    const e = erreichbarkeit("Technische Sachbearbeitung", [
      h("Office", "erfuellt"),
      h("Branchenkenntnis", "einarbeitung"),
      h("Staplerschein", "kurzschein", { muster: /x/, name: "Staplerschein", tage: 2 }),
      h("Elektrotechnische Ausbildung", "abschluss"),
    ]);
    expect(e.art).toBe("gesperrt");
  });
});

describe("lohntSich", () => {
  it("schliesst Abstiege aus", () => {
    /* Der erste Messlauf lieferte Lagerhelfer und Warenverräumung als
       Treffer. Technisch richtig, als Angebot eine Beleidigung. */
    expect(lohntSich(28000, 48000)).toBe(false);
    expect(lohntSich(48000, 48000)).toBe(true);
    expect(lohntSich(61000, 48000)).toBe(true);
  });

  it("entscheidet eine offene Frage nicht zu Lasten des Menschen", () => {
    /* Kennt man sein heutiges Gehalt nicht, ist unklar, ob es ein
       Abstieg wäre — und Unklarheit darf keine Stelle unterschlagen. */
    expect(lohntSich(30000, null)).toBe(true);
    expect(lohntSich(30000, 0)).toBe(true);
  });

  it("verwirft eine Stelle ohne Gehaltsangabe, wenn ein Vergleich möglich wäre", () => {
    /* Umgekehrt: Wer sein Gehalt kennt, soll keine Stelle sehen, bei
       der niemand sagen kann, ob sie schlechter zahlt. */
    expect(lohntSich(null, 48000)).toBe(false);
  });
});
