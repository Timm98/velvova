import { describe, expect, it } from "vitest";
import {
  BELEG_HOECHSTALTER_TAGE,
  CHANCENWORT,
  besterKanal,
  darfVorschlagen,
  istEineStelle,
  kanalVerwendbar,
  sicherheitAus,
  type Chancenlage,
  type Kontaktkanal,
} from "./stillechancen.ts";

const JETZT = new Date("2026-09-09T12:00:00Z");
const vorTagen = (n: number) => new Date(JETZT.getTime() - n * 86_400_000);

const kanal = (teil: Partial<Kontaktkanal> = {}): Kontaktkanal => ({
  art: "initiativformular",
  ziel: "https://landkreis.example/karriere/initiativbewerbung",
  belegUrl: "https://landkreis.example/karriere",
  geprueftAm: vorTagen(1),
  ...teil,
});

/** Der Fall, in dem alles erlaubt ist. Jeder Test verschlechtert genau eines. */
const OFFEN: Chancenlage = {
  passendeStelleVorhanden: false,
  karriereseiteGeprueftAm: vorTagen(1),
  initiativlage: "erwuenscht",
  kanaele: [kanal()],
  arbeitgeberart: "privat",
  letzterKontakt: null,
  unbeantworteteKontakte: 0,
  kontaktAbgelehnt: false,
  heuteVersendet: 0,
  dieseWocheVersendet: 0,
  vomNutzerAusgeschlossen: false,
  nutzerWillInitiativkontakt: true,
};

const urteil = (teil: Partial<Chancenlage> = {}) =>
  darfVorschlagen({ ...OFFEN, ...teil }, JETZT);

describe("Eine Vermutung ist kein Job", () => {
  it("nennt nur die ausgeschriebene Stelle eine Stelle", () => {
    expect(istEineStelle("oeffentliche_stelle")).toBe(true);
    expect(istEineStelle("stille_chance")).toBe(false);
    /*
     * Auch das Bestätigte nicht. Der Arbeitgeber hat gesagt, dass
     * etwas kommt — ausgeschrieben ist es damit nicht, und wer es
     * „Stelle" nennt, verspricht eine Bewerbungsmöglichkeit, die es
     * noch nicht gibt.
     */
    expect(istEineStelle("bestaetigte_moeglichkeit")).toBe(false);
  });

  it("schreibt über keine Vermutung das Wort Stelle", () => {
    expect(CHANCENWORT.stille_chance).not.toMatch(/stelle/i);
    expect(CHANCENWORT.bestaetigte_moeglichkeit).not.toMatch(/stelle/i);
  });
});

describe("Bestätigt sagt nur der Arbeitgeber", () => {
  it("gibt bestätigt bei einer Arbeitgeberantwort", () => {
    expect(
      sicherheitAus({ belege: 0, arbeitgeberHatBestaetigt: true, initiativlage: "unklar" }),
    ).toBe("bestaetigt");
  });

  it("erreicht ohne Arbeitgeberantwort höchstens hoch — egal wie viele Belege", () => {
    /*
     * Der Unterschied zwischen „sehr wahrscheinlich" und „gesagt" ist
     * der einzige, auf den sich jemand verlassen kann. Verwischt er,
     * ist die ganze Stufe wertlos.
     */
    expect(
      sicherheitAus({ belege: 99, arbeitgeberHatBestaetigt: false, initiativlage: "erwuenscht" }),
    ).toBe("hoch");
  });
});

describe("Ein Kontaktweg ohne Fundstelle ist geraten", () => {
  it("verwirft eine Adresse ohne Beleg", () => {
    /*
     * `vorname.nachname@firma.de` ist ein wahrscheinliches Format und
     * keine Auskunft. Wer danach schreibt, schreibt an jemanden, der
     * nie gesagt hat, dass er erreichbar sein will.
     */
    expect(kanalVerwendbar(kanal({ belegUrl: "" }), JETZT)).toBe(false);
  });

  it("verwirft einen Beleg, der zu alt ist", () => {
    expect(
      kanalVerwendbar(kanal({ geprueftAm: vorTagen(BELEG_HOECHSTALTER_TAGE + 1) }), JETZT),
    ).toBe(false);
  });

  it("nimmt das Initiativformular vor der allgemeinen Adresse", () => {
    const beste = besterKanal(
      [kanal({ art: "allgemeiner_kontakt" }), kanal({ art: "initiativformular" })],
      JETZT,
    );
    expect(beste?.art).toBe("initiativformular");
  });

  it("gibt keinen Kanal zurück, wenn keiner belegt ist", () => {
    expect(besterKanal([kanal({ belegUrl: "" })], JETZT)).toBeNull();
  });
});

describe("Die ausgeschriebene Stelle gewinnt immer", () => {
  it("schlägt keinen Kontakt vor, wenn es eine passende Anzeige gibt", () => {
    /*
     * Der peinlichste Fehler, den dieses System machen kann: einen
     * Arbeitgeber nach einer Stelle fragen, die er ausgeschrieben
     * hat. Er beweist, dass nicht nachgesehen wurde.
     */
    const u = urteil({ passendeStelleVorhanden: true });
    expect(u.darfVorschlagen).toBe(false);
    expect(u.grund).toMatch(/ausgeschriebene Stelle/);
  });

  it("nennt die Anzeige als Grund, nicht die Kontaktregeln", () => {
    /* Auch wenn gleichzeitig alles andere dagegen spräche. */
    const u = urteil({
      passendeStelleVorhanden: true,
      initiativlage: "ausgeschlossen",
      kanaele: [],
    });
    expect(u.grund).toMatch(/ausgeschriebene Stelle/);
  });
});

describe("Was jemand gesagt hat, schlägt jede Berechnung", () => {
  it("achtet den Ausschluss durch den Menschen", () => {
    expect(urteil({ vomNutzerAusgeschlossen: true }).darfVorschlagen).toBe(false);
  });

  it("achtet, dass jemand grundsätzlich keine Initiativkontakte will", () => {
    expect(urteil({ nutzerWillInitiativkontakt: false }).darfVorschlagen).toBe(false);
  });

  it("achtet die Ablehnung des Arbeitgebers", () => {
    expect(urteil({ kontaktAbgelehnt: true }).darfVorschlagen).toBe(false);
  });

  it("achtet einen ausdrücklichen Ausschluss auf der Karriereseite", () => {
    expect(urteil({ initiativlage: "ausgeschlossen" }).darfVorschlagen).toBe(false);
  });

  it("behandelt eine Bitte, davon abzusehen, wie ein Nein", () => {
    expect(urteil({ initiativlage: "unerwuenscht" }).darfVorschlagen).toBe(false);
  });
});

describe("Nicht nachgesehen ist nicht dasselbe wie unklar", () => {
  it("schlägt nichts vor, solange niemand nachgesehen hat", () => {
    expect(urteil({ initiativlage: "unbekannt" }).darfVorschlagen).toBe(false);
  });

  it("erlaubt eine vorsichtige Anfrage bei unklarer Lage", () => {
    const u = urteil({ initiativlage: "unklar" });
    expect(u.darfVorschlagen).toBe(true);
    /* Unklar heisst: fragen, nicht bewerben. */
    expect(u.anfrageart).toBe("stellenanfrage");
  });

  it("verlangt eine frische Prüfung der Karriereseite", () => {
    const u = urteil({ karriereseiteGeprueftAm: vorTagen(BELEG_HOECHSTALTER_TAGE + 1) });
    expect(u.darfVorschlagen).toBe(false);
    expect(u.grund).toMatch(/zu alt/);
  });
});

describe("Keine Nachfassschleifen", () => {
  it("hält die Abkühlung ein", () => {
    expect(urteil({ letzterKontakt: vorTagen(30) }).darfVorschlagen).toBe(false);
  });

  it("lässt nach der Abkühlung wieder zu", () => {
    expect(urteil({ letzterKontakt: vorTagen(120) }).darfVorschlagen).toBe(true);
  });

  it("fasst nicht nach, wenn eine Anfrage unbeantwortet blieb", () => {
    /* Wer nicht geantwortet hat, hat geantwortet. */
    expect(urteil({ unbeantworteteKontakte: 1, letzterKontakt: vorTagen(200) })
      .darfVorschlagen).toBe(false);
  });

  it("hält die Tagesgrenze ein", () => {
    expect(urteil({ heuteVersendet: 3 }).darfVorschlagen).toBe(false);
  });

  it("hält die Wochengrenze ein", () => {
    expect(urteil({ dieseWocheVersendet: 10 }).darfVorschlagen).toBe(false);
  });
});

describe("Der öffentliche Dienst", () => {
  it("bekommt nie eine Initiativbewerbung, auch wenn sie erwünscht wäre", () => {
    /*
     * Dort werden Stellen in geregelten Verfahren besetzt. Eine
     * Initiativbewerbung suggeriert, es ginge auch daran vorbei — was
     * nicht stimmt und der Person nicht hilft.
     */
    const u = urteil({ arbeitgeberart: "oeffentlich", initiativlage: "erwuenscht" });
    expect(u.darfVorschlagen).toBe(true);
    expect(u.anfrageart).toBe("stellenanfrage");
  });

  it("erlaubt bei privaten Arbeitgebern die Initiativbewerbung, wenn sie erwünscht ist", () => {
    expect(urteil({ arbeitgeberart: "privat", initiativlage: "erwuenscht" }).anfrageart)
      .toBe("initiativbewerbung");
  });

  it("bleibt bei privaten Arbeitgebern ohne Einladung bei der Anfrage", () => {
    expect(urteil({ arbeitgeberart: "privat", initiativlage: "erlaubt" }).anfrageart)
      .toBe("stellenanfrage");
  });
});

describe("Der erlaubte Fall", () => {
  it("nennt Kanal, Art und Grundlage", () => {
    const u = urteil();
    expect(u.darfVorschlagen).toBe(true);
    expect(u.kanal?.art).toBe("initiativformular");
    expect(u.anfrageart).toBe("initiativbewerbung");
    expect(u.grund).toMatch(/lädt ausdrücklich zu Initiativbewerbungen ein/i);
  });

  it("gibt bei jeder Ablehnung genau einen lesbaren Satz", () => {
    for (const lage of [
      { passendeStelleVorhanden: true },
      { vomNutzerAusgeschlossen: true },
      { initiativlage: "ausgeschlossen" as const },
      { kanaele: [] },
      { heuteVersendet: 9 },
    ]) {
      const u = urteil(lage);
      expect(u.darfVorschlagen).toBe(false);
      expect(u.grund.length).toBeGreaterThan(10);
      expect(u.kanal).toBeNull();
      expect(u.anfrageart).toBeNull();
    }
  });
});
