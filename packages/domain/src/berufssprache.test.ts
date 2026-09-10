import { describe, expect, it } from "vitest";
import { uebersetzungPruefen, verstossErklaeren, type Uebersetzung } from "./berufssprache.ts";

/**
 * Übersetzung und Schönfärberei unterscheiden sich nicht im Ton,
 * sondern im Inhalt. Diese Tests halten die Grenze — sie ist die
 * Grundlage des ganzen Produkts.
 */

const u = (original: string, fassung: string): Uebersetzung => ({
  original,
  fassung,
  belegId: "erfahrung-1",
});

describe("uebersetzungPruefen — was durchgehen muss", () => {
  it("lässt die echte Übersetzung durch", () => {
    /* Der Fall, um den es geht: null gemeinsame Wörter, und trotzdem
       dieselbe Arbeit. Die Wortüberlappungsprüfung in claims.ts würde
       genau das blockieren. */
    expect(
      uebersetzungPruefen(
        u("Hygienebeauftragte der Station", "Ordnungsverantwortung mit gesetzlicher Prüfpflicht"),
      ),
    ).toEqual({ art: "gueltig" });
  });

  it("lässt Einordnung und Fachbegriff der Zielbranche zu", () => {
    expect(
      uebersetzungPruefen(
        u("Angehörigengespräche, Beschwerden", "Eskalationsmanagement mit emotional belasteten Anspruchsberechtigten"),
      ).art,
    ).toBe("gueltig");
  });

  it("lässt eine Zahl durch, die im Original steht", () => {
    expect(
      uebersetzungPruefen(
        u("Dienstplanung für 14 Personen", "Einsatzplanung für 14 Mitarbeitende im Schichtbetrieb"),
      ).art,
    ).toBe("gueltig");
  });
});

describe("uebersetzungPruefen — was nicht durchgehen darf", () => {
  it("fängt eine erfundene Zahl", () => {
    /* Der härteste Fall und der einfachste Test: Hier gibt es kein
       Ermessen. */
    const b = uebersetzungPruefen(u("Dienstplanung für 14 Personen", "Einsatzplanung für 40 Mitarbeitende"));
    expect(b.art).toBe("erfunden");
    if (b.art === "erfunden") expect(b.verstoesse[0]).toEqual({ art: "zahl", wert: "40" });
  });

  it("fängt eine erfundene Führungsrolle", () => {
    /*
     * „Vertretung der Leitung" ist etwas anderes als „Leitung des
     * Qualitätsmanagements". Der Unterschied sind zwei Wörter im
     * Lebenslauf und die ganze Frage im Gespräch.
     */
    const b = uebersetzungPruefen(
      u("Hygienebeauftragte der Station", "Leitung des Qualitätsmanagements"),
    );
    expect(b.art).toBe("erfunden");
    if (b.art === "erfunden") expect(b.verstoesse.some((v) => v.art === "fuehrung")).toBe(true);
  });

  it("fängt eine erfundene Qualifikation", () => {
    const b = uebersetzungPruefen(
      u("Anleitung von Auszubildenden", "Zertifizierte Ausbilderin nach AEVO"),
    );
    expect(b.art).toBe("erfunden");
    if (b.art === "erfunden") expect(b.verstoesse.some((v) => v.art === "qualifikation")).toBe(true);
  });

  it("fängt Wertungen", () => {
    const b = uebersetzungPruefen(
      u("Dokumentation in Pflegesoftware", "Umfassende Erfahrung in der hervorragenden Dokumentation"),
    );
    expect(b.art).toBe("erfunden");
    if (b.art === "erfunden") expect(b.verstoesse.every((v) => v.art === "wertung")).toBe(true);
  });

  it("erlaubt Führungswörter, die im Original stehen", () => {
    /* Wer „Vertretung der Stationsleitung" schreibt, darf das Wort
       auch in der Übersetzung benutzen — verboten ist das Hinzufügen,
       nicht das Wort. */
    expect(
      uebersetzungPruefen(
        u("Vertretung der Stationsleitung", "Stellvertretende Leitung einer Station mit 14 Betten"),
      ).art,
    ).toBe("erfunden"); // die 14 ist neu
    expect(
      uebersetzungPruefen(u("Vertretung der Stationsleitung", "Stellvertretende Leitung im Schichtbetrieb")).art,
    ).toBe("gueltig");
  });
});

describe("uebersetzungPruefen — unbrauchbare Eingaben", () => {
  it("verlangt Original, Fassung und Beleg", () => {
    expect(uebersetzungPruefen({ original: "", fassung: "X", belegId: "e1" })).toEqual({
      art: "unbrauchbar",
      grund: "kein_original",
    });
    expect(uebersetzungPruefen({ original: "X", fassung: "  ", belegId: "e1" })).toEqual({
      art: "unbrauchbar",
      grund: "keine_fassung",
    });
    expect(uebersetzungPruefen({ original: "X", fassung: "Y", belegId: "" })).toEqual({
      art: "unbrauchbar",
      grund: "kein_beleg",
    });
  });

  it("verwirft eine Übersetzung, die nichts übersetzt", () => {
    /*
     * Sie sieht wie Arbeit aus und ist keine — und sie verstellt den
     * Blick darauf, dass für diese Zeile keine Brücke gefunden wurde.
     */
    for (const fassung of ["Dienstplanung", "dienstplanung"]) {
      const b = uebersetzungPruefen(u("Dienstplanung", fassung));
      expect(b.art).toBe("unbrauchbar");
      if (b.art === "unbrauchbar") expect(b.grund).toBe("unveraendert");
    }
  });
});

describe("verstossErklaeren", () => {
  it("sagt dem Menschen, warum eine Zeile fehlt", () => {
    /* Nicht „konnte nicht übersetzt werden". Wer eine Lücke sieht,
       soll wissen, warum — sonst hält er das Produkt für kaputt, wo
       es vorsichtig war. */
    expect(verstossErklaeren({ art: "zahl", wert: "40" })).toContain("40");
    expect(verstossErklaeren({ art: "fuehrung", wort: "Leitung" })).toContain("Führungsrolle");
    expect(verstossErklaeren({ art: "qualifikation", wort: "Zertifizierte" })).toContain("Abschluss");
    expect(verstossErklaeren({ art: "wertung", wort: "hervorragend" })).toContain("Wertung");
  });
});
