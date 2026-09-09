import { describe, expect, it } from "vitest";
import { accepteSprachen, spracheAufloesen } from "./aufloesen.ts";

/*
 * Die Fälle stammen aus dem Auftrag und sind bewusst so benannt, wie
 * ein Mensch sie beschreiben würde — nicht nach der Zeile, die sie
 * prüfen. Wer eine dieser Zeilen rot sieht, weiss sofort, welcher
 * Besucher etwas Falsches bekommt.
 */

/** Was es heute wirklich an Texten gibt. */
const HEUTE = ["de", "en"];
/** Ein gedachter Stand, in dem alle sieben Kataloge existieren. */
const SPAETER = ["de", "en", "fr", "es", "it", "nl", "pl"];

describe("Rangfolge", () => {
  it("nimmt die ausdrückliche Wahl vor allem anderen", () => {
    expect(
      spracheAufloesen(
        { gewaehlt: "de", konto: "en", cookie: "en", browsersprachen: ["fr-FR"], land: "FR" },
        SPAETER,
      ),
    ).toBe("de");
  });

  it("lässt eine gespeicherte Wahl nicht von Browser und Land überschreiben", () => {
    /*
     * Der Fall aus dem Auftrag: IP Frankreich, Browser Französisch,
     * gespeichert Deutsch. Ergebnis muss Deutsch sein — sonst wechselt
     * einem Reisenden die Sprache unter den Händen.
     */
    expect(
      spracheAufloesen({ cookie: "de", browsersprachen: ["fr-FR", "fr"], land: "FR" }, SPAETER),
    ).toBe("de");
  });

  it("zieht das Konto dem Cookie vor", () => {
    expect(spracheAufloesen({ konto: "it", cookie: "de" }, SPAETER)).toBe("it");
  });

  it("nimmt den Browser, wenn nichts gewählt wurde", () => {
    expect(spracheAufloesen({ browsersprachen: ["nl-NL"], land: "DE" }, SPAETER)).toBe("nl");
  });

  it("nimmt das Land erst, wenn der Browser nichts hergibt", () => {
    expect(spracheAufloesen({ browsersprachen: [], land: "PL" }, SPAETER)).toBe("pl");
  });
});

describe("Die Schweiz", () => {
  /*
   * Der Kern: Das Land CH sagt nicht, welche der vier Sprachen gemeint
   * ist. Der Browser sagt es. Deshalb steht er in der Rangfolge davor.
   */
  it("gibt bei de-CH Deutsch", () => {
    expect(spracheAufloesen({ browsersprachen: ["de-CH"], land: "CH" }, SPAETER)).toBe("de");
  });

  it("gibt bei fr-CH Französisch — nicht Deutsch", () => {
    expect(spracheAufloesen({ browsersprachen: ["fr-CH"], land: "CH" }, SPAETER)).toBe("fr");
  });

  it("gibt bei it-CH Italienisch", () => {
    expect(spracheAufloesen({ browsersprachen: ["it-CH"], land: "CH" }, SPAETER)).toBe("it");
  });

  it("fällt ohne Browserangabe auf die grösste Gruppe zurück", () => {
    expect(spracheAufloesen({ browsersprachen: [], land: "CH" }, SPAETER)).toBe("de");
  });
});

describe("Nur Sprachen, für die es Texte gibt", () => {
  /*
   * Der stille Fehler, den diese Regel verhindert: `getTranslator`
   * fällt bei fehlendem Katalog auf die Standardsprache zurück. Ohne
   * diese Prüfung bekäme ein Franzose Deutsch und hielte es für einen
   * Fehler statt für eine fehlende Übersetzung.
   */
  it("überspringt eine vorbereitete Sprache ohne Katalog", () => {
    expect(spracheAufloesen({ browsersprachen: ["fr-FR", "en-GB"] }, HEUTE)).toBe("en");
  });

  it("ignoriert auch eine gespeicherte Wahl ohne Katalog", () => {
    expect(spracheAufloesen({ cookie: "pl", browsersprachen: ["de-DE"] }, HEUTE)).toBe("de");
  });

  it("nimmt das Land nur, wenn dessen Sprache Texte hat", () => {
    /* Spanien, aber es gibt kein Spanisch — dann Englisch, nicht Deutsch. */
    expect(spracheAufloesen({ land: "ES" }, HEUTE)).toBe("en");
  });
});

describe("Fehlerfälle", () => {
  it("fällt ohne jedes Signal auf Englisch", () => {
    expect(spracheAufloesen({}, SPAETER)).toBe("en");
  });

  it("kommt mit einem unbekannten Land zurecht", () => {
    expect(spracheAufloesen({ land: "XX" }, SPAETER)).toBe("en");
  });

  it("kommt mit unbrauchbaren Browserangaben zurecht", () => {
    expect(spracheAufloesen({ browsersprachen: ["", "  ", "zz-ZZ"] }, SPAETER)).toBe("en");
  });

  it("liest Ländercodes unabhängig von Gross- und Kleinschreibung", () => {
    expect(spracheAufloesen({ land: "nl" }, SPAETER)).toBe("nl");
  });

  it("gibt nie eine Sprache zurück, die es nicht gibt", () => {
    /*
     * Auch im Randfall: Gäbe es nur Polnisch, wäre Englisch als
     * Rückfall eine Zusicherung, die die Funktion nicht halten kann.
     */
    expect(spracheAufloesen({}, ["pl"])).toBe("pl");
  });
});

describe("Accept-Language zerlegen", () => {
  it("sortiert nach Gewicht statt der Schreibreihenfolge zu vertrauen", () => {
    expect(accepteSprachen("de;q=0.5, fr-CH, en;q=0.8")).toEqual(["fr-CH", "en", "de"]);
  });

  it("behält die Region, damit die Schweiz entscheidbar bleibt", () => {
    expect(accepteSprachen("fr-CH,fr;q=0.9")).toEqual(["fr-CH", "fr"]);
  });

  it("wirft den Platzhalter weg", () => {
    expect(accepteSprachen("*")).toEqual([]);
  });

  it("kommt mit fehlender Kopfzeile zurecht", () => {
    expect(accepteSprachen(null)).toEqual([]);
    expect(accepteSprachen("")).toEqual([]);
  });
});
