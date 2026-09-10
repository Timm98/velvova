import { describe, expect, it } from "vitest";
import { ebenenrang } from "./bedarfsebenen.ts";
import {
  MAX_THEMEN,
  TOTZEIT_MINUTEN,
  type Themenstand,
  berichtsmonat,
  berichtslage,
  laufAufnehmbar,
  monatsanfang,
  staendeVergleichen,
  teilzeitraumHinweis,
} from "./monatsbericht.ts";

const T = (teil: Partial<Themenstand> & { schluessel: string }): Themenstand => ({
  titel: `Thema ${teil.schluessel}`,
  ebene: "beobachtung",
  befundstand: "hypothese",
  quellen: 1,
  methodenkennung: "m1",
  ...teil,
});

const rang = (e: string) => ebenenrang(e as never);

describe("Fehlende Daten sind keine Lösung", () => {
  it("nennt ein verschwundenes Thema „nicht mehr gemessen“ und nicht gelöst", () => {
    const v = staendeVergleichen([T({ schluessel: "a" })], [], rang);
    expect(v).toHaveLength(1);
    expect(v[0]!.art).toBe("nicht_mehr_gemessen");
  });

  it("behauptet in keinem Fall eine Lösung", () => {
    const v = staendeVergleichen(
      [T({ schluessel: "a" }), T({ schluessel: "b" })],
      [T({ schluessel: "b" })],
      rang,
    );
    expect(v.map((x) => x.art)).not.toContain("geloest");
  });
});

describe("Ein Methodenwechsel ist keine Verbesserung", () => {
  it("setzt den Vergleich aus, auch wenn die Ebene gestiegen ist", () => {
    const v = staendeVergleichen(
      [T({ schluessel: "a", ebene: "beduerfnis", methodenkennung: "m1" })],
      [T({ schluessel: "a", ebene: "bestaetigtes_problem", methodenkennung: "m2" })],
      rang,
    );
    expect(v[0]!.art).toBe("methode_gewechselt");
  });

  it("lässt bei gleicher Methode den Fortschritt gelten", () => {
    const v = staendeVergleichen(
      [T({ schluessel: "a", ebene: "beduerfnis" })],
      [T({ schluessel: "a", ebene: "beobachtung" })],
      rang,
    );
    expect(v[0]!.art).toBe("fortgeschritten");
  });
});

describe("Was der Vergleich sonst erkennt", () => {
  it("erkennt Neues", () => {
    expect(staendeVergleichen([], [T({ schluessel: "a" })], rang)[0]!.art).toBe("neu");
  });

  it("erkennt einen verworfenen Befund vor allem anderen", () => {
    const v = staendeVergleichen(
      [T({ schluessel: "a", ebene: "beduerfnis", befundstand: "hypothese" })],
      [T({ schluessel: "a", ebene: "beobachtung", befundstand: "verworfen" })],
      rang,
    );
    expect(v[0]!.art).toBe("zurueckgenommen");
  });

  it("erkennt Stillstand", () => {
    const v = staendeVergleichen([T({ schluessel: "a" })], [T({ schluessel: "a" })], rang);
    expect(v[0]!.art).toBe("unveraendert");
  });
});

describe("Kein belastbarer neuer Stand", () => {
  it("ist das Ergebnis, wenn sich nichts bewegt hat", () => {
    const v = staendeVergleichen([T({ schluessel: "a" })], [T({ schluessel: "a" })], rang);
    const l = berichtslage(v);
    expect(l.art).toBe("kein_neuer_stand");
  });

  it("ist das Ergebnis ohne jedes Thema", () => {
    expect(berichtslage([]).art).toBe("kein_neuer_stand");
  });

  it("stellt sonst höchstens drei Themen voran und zählt den Rest", () => {
    const jetzt = ["a", "b", "c", "d", "e"].map((s) => T({ schluessel: s }));
    const l = berichtslage(staendeVergleichen([], jetzt, rang));
    expect(l.art).toBe("stand");
    if (l.art === "stand") {
      expect(l.themen).toHaveLength(MAX_THEMEN);
      expect(l.weitere).toBe(2);
    }
  });

  it("stellt die Rücknahme vor das Neue", () => {
    const v = staendeVergleichen(
      [T({ schluessel: "alt", befundstand: "bestaetigt" })],
      [T({ schluessel: "alt", befundstand: "verworfen" }), T({ schluessel: "neu" })],
      rang,
    );
    const l = berichtslage(v);
    if (l.art === "stand") expect(l.themen[0]!.art).toBe("zurueckgenommen");
  });
});

describe("Der Berichtsmonat", () => {
  it("ist der letzte vollständige, nicht der laufende", () => {
    expect(berichtsmonat(new Date("2026-10-03T08:00:00Z"))).toBe("2026-09");
  });

  it("trägt über den Jahreswechsel", () => {
    expect(berichtsmonat(new Date("2027-01-02T08:00:00Z"))).toBe("2026-12");
  });

  it("ist für zwei Auslöser desselben Monats derselbe", () => {
    const a = berichtsmonat(new Date("2026-10-01T23:30:00Z"));
    const b = berichtsmonat(new Date("2026-10-28T05:00:00Z"));
    expect(a).toBe(b);
  });

  it("rechnet in der angegebenen Zeitzone", () => {
    /*
     * 30.09. 23:00 UTC ist in Berlin bereits der 1. Oktober. Wer in
     * UTC rechnet, berichtet an diesem Abend über den August.
     */
    const berlin = berichtsmonat(new Date("2026-09-30T23:00:00Z"), "Europe/Berlin");
    expect(berlin).toBe("2026-09");
  });

  it("liefert einen Monatsanfang, den die Datenbank versteht", () => {
    expect(monatsanfang("2026-09")).toBe("2026-09-01");
  });
});

describe("Der unvollständige Zeitraum", () => {
  it("schweigt beim vollen Monat", () => {
    expect(teilzeitraumHinweis(30, 30)).toBeNull();
  });

  it("nennt beide Zahlen, wenn Tage fehlen", () => {
    const h = teilzeitraumHinweis(11, 30)!;
    expect(h).toContain("11");
    expect(h).toContain("30");
  });
});

describe("Ein Cron-Auslöser allein genügt nicht", () => {
  const jetzt = new Date("2026-10-01T12:00:00Z");

  it("erzeugt keinen zweiten Bericht für denselben Monat", () => {
    expect(laufAufnehmbar("fertig", new Date("2026-10-01T00:00:00Z"), jetzt).ja).toBe(false);
  });

  it("lässt einen laufenden in Ruhe", () => {
    const eben = new Date(jetzt.getTime() - 5 * 60_000);
    expect(laufAufnehmbar("laeuft", eben, jetzt).ja).toBe(false);
  });

  it("nimmt einen hängenden nach der Totzeit wieder auf", () => {
    const lange = new Date(jetzt.getTime() - (TOTZEIT_MINUTEN + 1) * 60_000);
    expect(laufAufnehmbar("laeuft", lange, jetzt).ja).toBe(true);
  });

  it("nimmt einen abgebrochenen sofort wieder auf", () => {
    expect(laufAufnehmbar("abgebrochen", jetzt, jetzt).ja).toBe(true);
  });
});
