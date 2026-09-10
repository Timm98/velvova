import { describe, expect, it } from "vitest";
import {
  EBENEN,
  MAX_FRAGEN_RUNDE,
  type Aufstiegslage,
  aufstiegPruefen,
  brauchtMenschen,
  darfAngebotEntstehen,
  ebenensignal,
  ebenenrang,
  fragenAuswaehlen,
  istPersonalbedarf,
  klaerungsfragen,
  rolleBelegt,
} from "./bedarfsebenen.ts";

const leer: Aufstiegslage = {
  unabhaengigeBelege: 0,
  gegenbelegeGeprueft: false,
  alternativen: [],
  vomUnternehmenBestaetigt: false,
  freigabeVon: null,
  weg: null,
};

describe("Die Reihenfolge der Ebenen", () => {
  it("steht fest und beginnt beim Wunsch", () => {
    expect(EBENEN[0]).toBe("beduerfnis");
    expect(EBENEN.at(-1)).toBe("freigegebene_moeglichkeit");
    expect(ebenenrang("hypothese")).toBeLessThan(ebenenrang("bestaetigtes_problem"));
  });
});

describe("Ein bestätigtes Problem ist kein Personalbedarf", () => {
  it("verneint Personalbedarf auf jeder Ebene unterhalb des Lösungsbedarfs", () => {
    for (const e of EBENEN.slice(0, ebenenrang("loesungsbedarf"))) {
      expect(istPersonalbedarf(e, "rolle_schaffen")).toBe(false);
    }
  });

  it("verneint ihn auch beim Lösungsbedarf, wenn der Weg ohne Menschen auskommt", () => {
    expect(istPersonalbedarf("loesungsbedarf", "zustaendigkeit_klaeren")).toBe(false);
    expect(istPersonalbedarf("loesungsbedarf", "erst_messen")).toBe(false);
    expect(istPersonalbedarf("loesungsbedarf", null)).toBe(false);
  });

  it("bejaht ihn nur bei Auftrag oder neuer Rolle", () => {
    expect(istPersonalbedarf("loesungsbedarf", "auftrag_vergeben")).toBe(true);
    expect(istPersonalbedarf("loesungsbedarf", "rolle_schaffen")).toBe(true);
  });

  it("hält „erst messen“ und „vorerst beobachten“ als gültige Wege ohne Menschen", () => {
    expect(brauchtMenschen("erst_messen")).toBe(false);
    expect(brauchtMenschen("vorerst_beobachten")).toBe(false);
  });
});

describe("Der Riegel vor dem Angebot", () => {
  it("lässt aus einem bestätigten Problem allein kein Angebot entstehen", () => {
    expect(darfAngebotEntstehen("bestaetigtes_problem", "rolle_schaffen")).toBe(false);
  });

  it("lässt es entstehen, wenn der Lösungsbedarf steht und eine Rolle der Weg ist", () => {
    expect(darfAngebotEntstehen("loesungsbedarf", "rolle_schaffen")).toBe(true);
  });
});

describe("Der Aufstieg um eine Ebene", () => {
  it("weist den Sprung über eine Ebene ab", () => {
    const a = aufstiegPruefen("beduerfnis", "bestaetigtes_problem", {
      ...leer,
      unabhaengigeBelege: 9,
      gegenbelegeGeprueft: true,
      alternativen: ["Kapazität"],
      vomUnternehmenBestaetigt: true,
    });
    expect(a.erlaubt).toBe(false);
  });

  it("weist den Rückschritt ab", () => {
    expect(aufstiegPruefen("hypothese", "beobachtung", leer).erlaubt).toBe(false);
  });

  it("verlangt für die Beobachtung mindestens einen Beleg", () => {
    expect(aufstiegPruefen("beduerfnis", "beobachtung", leer).erlaubt).toBe(false);
    expect(
      aufstiegPruefen("beduerfnis", "beobachtung", { ...leer, unabhaengigeBelege: 1 }).erlaubt,
    ).toBe(true);
  });

  it("lässt die Hypothese ohne Voraussetzung zu", () => {
    expect(aufstiegPruefen("beobachtung", "hypothese", leer).erlaubt).toBe(true);
  });
});

describe("Was ein bestätigtes Problem verlangt", () => {
  const fast: Aufstiegslage = {
    unabhaengigeBelege: 2,
    gegenbelegeGeprueft: true,
    alternativen: ["Die Fälle waren komplexer."],
    vomUnternehmenBestaetigt: true,
    freigabeVon: null,
    weg: null,
  };

  it("geht durch, wenn alles vorliegt", () => {
    expect(aufstiegPruefen("hypothese", "bestaetigtes_problem", fast).erlaubt).toBe(true);
  });

  it("scheitert ohne alternative Erklärung", () => {
    const a = aufstiegPruefen("hypothese", "bestaetigtes_problem", { ...fast, alternativen: [] });
    expect(a.erlaubt).toBe(false);
    if (!a.erlaubt) expect(a.grund).toMatch(/alternative Erklärung/);
  });

  it("scheitert, wenn nach Gegenbelegen nicht gesucht wurde", () => {
    const a = aufstiegPruefen("hypothese", "bestaetigtes_problem", {
      ...fast,
      gegenbelegeGeprueft: false,
    });
    expect(a.erlaubt).toBe(false);
  });

  it("scheitert bei nur einer Quelle", () => {
    const a = aufstiegPruefen("hypothese", "bestaetigtes_problem", {
      ...fast,
      unabhaengigeBelege: 1,
    });
    expect(a.erlaubt).toBe(false);
    if (!a.erlaubt) expect(a.grund).toMatch(/Kopien/);
  });

  it("scheitert ohne Bestätigung im Betrieb", () => {
    const a = aufstiegPruefen("hypothese", "bestaetigtes_problem", {
      ...fast,
      vomUnternehmenBestaetigt: false,
    });
    expect(a.erlaubt).toBe(false);
  });
});

describe("Die Freigabe ganz am Ende", () => {
  it("scheitert, wenn niemand freigegeben hat", () => {
    const a = aufstiegPruefen("loesungsbedarf", "freigegebene_moeglichkeit", {
      ...leer,
      weg: "rolle_schaffen",
    });
    expect(a.erlaubt).toBe(false);
  });

  it("scheitert, wenn der gewählte Weg keinen Menschen braucht", () => {
    const a = aufstiegPruefen("loesungsbedarf", "freigegebene_moeglichkeit", {
      ...leer,
      weg: "werkzeug_einsetzen",
      freigabeVon: "Leitung Kundenservice",
    });
    expect(a.erlaubt).toBe(false);
  });

  it("geht durch mit Freigabe und Personenweg", () => {
    const a = aufstiegPruefen("loesungsbedarf", "freigegebene_moeglichkeit", {
      ...leer,
      weg: "auftrag_vergeben",
      freigabeVon: "Leitung Kundenservice",
    });
    expect(a.erlaubt).toBe(true);
  });
});

describe("Höchstens drei Fragen je Runde", () => {
  it("kürzt auf drei", () => {
    const f = fragenAuswaehlen(["a", "b", "c", "d", "e"], []);
    expect(f).toHaveLength(MAX_FRAGEN_RUNDE);
    expect(f).toEqual(["a", "b", "c"]);
  });

  it("fragt Bestätigtes nicht noch einmal", () => {
    expect(fragenAuswaehlen(["Gehalt?", "Ort?"], [" gehalt? "])).toEqual(["Ort?"]);
  });
});

describe("Das Signal — nicht die Einstufung", () => {
  it("erkennt den Wunsch", () => {
    expect(ebenensignal("Wir möchten Kunden schneller antworten.")).toBe("beduerfnis");
  });

  it("erkennt die Beobachtung", () => {
    expect(ebenensignal("Einige Anfragen bleiben mehrere Tage liegen.")).toBe("beobachtung");
  });

  it("nennt den Wunsch, wenn ein Satz beides enthält", () => {
    expect(
      ebenensignal("Wir möchten schneller antworten, es bleiben Anfragen liegen."),
    ).toBe("beduerfnis");
  });

  it("gibt null zurück, wenn nichts darauf hindeutet", () => {
    expect(ebenensignal("Wir suchen eine Lagerfachkraft in Vollzeit, 3.200 brutto.")).toBeNull();
  });
});

describe("Die Rolle muss im Text stehen", () => {
  it("erkennt die genannte Rolle trotz Beugung", () => {
    expect(rolleBelegt("Lagerfachkraft", "Wir suchen zwei Lagerfachkräfte in Vollzeit.")).toBe(true);
  });

  it("weist die erfundene Rolle ab, auch wenn ein Wort daraus vorkommt", () => {
    expect(rolleBelegt("Kundenservice-Mitarbeiter", "Wir möchten Kunden schneller antworten.")).toBe(false);
  });

  it("hält null für belegt — es wurde nichts behauptet", () => {
    expect(rolleBelegt(null, "irgendetwas")).toBe(true);
  });

  it("verlangt jedes inhaltliche Wort", () => {
    const t = "Wir brauchen jemanden für die Debitorenbuchhaltung.";
    expect(rolleBelegt("Sachbearbeiter Debitorenbuchhaltung", t)).toBe(false);
    expect(rolleBelegt("Debitorenbuchhaltung", t)).toBe(true);
  });
});

describe("Die Fragen, die aus einer Situation eine Beobachtung machen", () => {
  it("gibt höchstens drei und je Ebene verschiedene", () => {
    expect(klaerungsfragen("beduerfnis")).toHaveLength(3);
    expect(klaerungsfragen("beobachtung")[0]).toMatch(/Zeitraum/);
    expect(klaerungsfragen("beduerfnis")[0]).not.toBe(klaerungsfragen("beobachtung")[0]);
  });

  it("gibt nichts zurück, wo es kein Signal gibt", () => {
    expect(klaerungsfragen(null)).toEqual([]);
    expect(klaerungsfragen("loesungsbedarf")).toEqual([]);
  });
});
