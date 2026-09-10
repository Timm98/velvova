import { describe, expect, it } from "vitest";
import {
  GUELTIGKEIT_MINUTEN,
  darfSenden,
  freigabeFrage,
  freigabePruefen,
  freigabeText,
  gueltigBis,
  type Freigabestand,
  type Freigabezeile,
} from "./versandfreigabe.ts";

const JETZT = new Date("2026-09-11T09:00:00Z");

const ZEILE = (teil: Partial<Freigabezeile> = {}): Freigabezeile => ({
  empfaenger: "bewerbung@traeger-xy.de",
  fingerabdruck: "abc123",
  gueltigBis: new Date("2026-09-12T09:00:00Z"),
  verwendetAm: null,
  widerrufenAm: null,
  ...teil,
});

const VERSUCH = { empfaenger: "bewerbung@traeger-xy.de", fingerabdruck: "abc123", jetzt: JETZT };

describe("freigabePruefen", () => {
  it("lässt eine gültige Freigabe durch", () => {
    expect(freigabePruefen(ZEILE(), VERSUCH)).toBe("gueltig");
    expect(darfSenden("gueltig")).toBe(true);
  });

  it("sendet ohne Freigabe nichts", () => {
    /* Der Normalfall, nicht der Ausnahmefall: ohne Zeile kein Versand. */
    expect(freigabePruefen(null, VERSUCH)).toBe("unbekannt");
    expect(darfSenden(freigabePruefen(null, VERSUCH))).toBe(false);
  });

  it("verweigert einen zweiten Versand", () => {
    const stand = freigabePruefen(ZEILE({ verwendetAm: new Date("2026-09-11T08:00:00Z") }), VERSUCH);
    expect(stand).toBe("verbraucht");
    expect(darfSenden(stand)).toBe(false);
  });

  it("verweigert nach Ablauf", () => {
    const stand = freigabePruefen(ZEILE({ gueltigBis: new Date("2026-09-11T08:59:59Z") }), VERSUCH);
    expect(stand).toBe("abgelaufen");
  });

  it("verweigert nach Widerruf", () => {
    expect(freigabePruefen(ZEILE({ widerrufenAm: JETZT }), VERSUCH)).toBe("widerrufen");
  });

  it("verweigert einen anderen Empfänger", () => {
    /*
     * Die Freigabe gilt der Nachricht an diese Adresse. Sie ist keine
     * Erlaubnis, mit demselben Token woandershin zu schreiben.
     */
    const stand = freigabePruefen(ZEILE(), { ...VERSUCH, empfaenger: "chef@aktueller-arbeitgeber.de" });
    expect(stand).toBe("empfaenger_abweichend");
  });

  it("verweigert einen geänderten Text", () => {
    /*
     * Der Kern der Sache. Freigegeben war die Fassung, die der Mensch
     * gelesen hat — nicht „eine Bewerbung an diese Adresse".
     */
    const stand = freigabePruefen(ZEILE(), { ...VERSUCH, fingerabdruck: "anders" });
    expect(stand).toBe("inhalt_abweichend");
  });

  it("stellt die Sperre über jede gültige Freigabe", () => {
    /*
     * Eine Sperre kann nach der Freigabe entstanden sein. Dann ist die
     * Freigabe älter als die Tatsache — und die Tatsache gewinnt.
     */
    const stand = freigabePruefen(ZEILE(), { ...VERSUCH, gesperrt: true });
    expect(stand).toBe("arbeitgeber_gesperrt");
    expect(darfSenden(stand)).toBe(false);
  });

  it("nennt bei einer fremden Nachricht nicht den falschen Grund", () => {
    /*
     * Wer eine andere Nachricht mit einem abgelaufenen Token schickt,
     * soll die Wahrheit hören und nicht „abgelaufen" — sonst probiert
     * er es mit einem frischen Token noch einmal.
     */
    const zeile = ZEILE({ gueltigBis: new Date("2026-09-10T09:00:00Z") });
    expect(freigabePruefen(zeile, { ...VERSUCH, fingerabdruck: "anders" })).toBe("inhalt_abweichend");
  });

  it("lässt nur genau einen Stand senden", () => {
    const alle: Freigabestand[] = [
      "gueltig",
      "unbekannt",
      "abgelaufen",
      "verbraucht",
      "widerrufen",
      "empfaenger_abweichend",
      "inhalt_abweichend",
      "arbeitgeber_gesperrt",
    ];
    expect(alle.filter(darfSenden)).toEqual(["gueltig"]);
  });
});

describe("freigabeText", () => {
  it("erklärt jeden Stand ohne „ein Fehler ist aufgetreten“", () => {
    const alle: Freigabestand[] = [
      "gueltig",
      "unbekannt",
      "abgelaufen",
      "verbraucht",
      "widerrufen",
      "empfaenger_abweichend",
      "inhalt_abweichend",
      "arbeitgeber_gesperrt",
    ];
    for (const s of alle) {
      const text = freigabeText(s);
      expect(text.length).toBeGreaterThan(10);
      expect(text.toLowerCase()).not.toContain("fehler ist aufgetreten");
    }
    expect(new Set(alle.map(freigabeText)).size).toBe(alle.length);
  });

  it("sagt bei nicht erfolgtem Versand, dass nichts hinausging", () => {
    for (const s of ["unbekannt", "widerrufen", "empfaenger_abweichend"] as Freigabestand[]) {
      expect(freigabeText(s)).toMatch(/nichts versendet|nichts hinaus/);
    }
  });
});

describe("freigabeFrage", () => {
  it("nennt Empfänger und Anhänge", () => {
    const frage = freigabeFrage("bewerbung@traeger-xy.de", ["Lebenslauf.pdf", "Zeugnis.pdf"]);
    expect(frage).toContain("bewerbung@traeger-xy.de");
    expect(frage).toContain("2 Anhängen");
  });

  it("sagt, dass es nicht zurückholbar ist", () => {
    expect(freigabeFrage("a@b.de", [])).toContain("zurückholen");
  });
});

describe("gueltigBis", () => {
  it("rechnet die Gültigkeit an einer Stelle", () => {
    expect(gueltigBis(JETZT).getTime() - JETZT.getTime()).toBe(GUELTIGKEIT_MINUTEN * 60_000);
  });
});
