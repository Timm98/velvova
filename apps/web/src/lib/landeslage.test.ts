import { describe, expect, it } from "vitest";
import { lageFuer } from "./landeslage.ts";

/**
 * Was die Landingpage über ein Land behaupten darf.
 *
 * Der teure Fehler ist hier nicht ein fehlender Hinweis, sondern ein
 * fehlender BEI EINEM LAND, für das es das Versprechen nicht gibt.
 * Jemandem in Zürich „3.114 € netto" zu zeigen, ist nicht ungenau —
 * es ist falsch, und er merkt es erst nach der Anmeldung.
 */

describe("Deutschland", () => {
  it("kann alles und bekommt deshalb keinen Hinweis", () => {
    /*
     * Ein Band, das immer da ist, liest niemand mehr. Wo nichts
     * einzuschränken ist, steht nichts.
     */
    const l = lageFuer("DE");
    expect(l.nettoRechnung).toBe(true);
    expect(l.markt).toBe("voll");
    expect(l.hinweis).toBeNull();
  });

  it("gilt auch ohne Angabe", () => {
    // Der Normalfall im lokalen Betrieb und hinter Anbietern ohne
    // Länderkopfzeile. Deutschland ist das einzige Land, für das dieses
    // Produkt heute vollständig funktioniert.
    expect(lageFuer(null).code).toBe("DE");
    expect(lageFuer(undefined).hinweis).toBeNull();
  });

  it("nimmt Kleinschreibung an", () => {
    expect(lageFuer("de").code).toBe("DE");
  });
});

describe("Länder mit Stellen, aber ohne Steuerregelwerk", () => {
  for (const code of ["AT", "CH"]) {
    it(`nennt für ${code} genau diese Einschränkung`, () => {
      const l = lageFuer(code);
      expect(l.markt).toBe("teilweise");
      expect(l.nettoRechnung).toBe(false);
      expect(l.hinweis).toMatch(/Steuerregelwerk/);
      // Und es sagt auch, was funktioniert. Ein Hinweis, der nur
      // aufzählt, was fehlt, vertreibt jemanden, für den der Rest
      // reicht.
      expect(l.hinweis).toMatch(/funktioniert|Stellen/);
    });
  }

  it("nennt die richtige Währung", () => {
    expect(lageFuer("CH").waehrung).toBe("CHF");
    expect(lageFuer("AT").waehrung).toBe("EUR");
  });
});

describe("Länder ohne alles", () => {
  it("sagt klar, dass die Suche hier nichts findet", () => {
    /*
     * Die unangenehme Auskunft, und deshalb die wichtigste.
     *
     * Wer aus Portugal kommt und „prüft echte Stellen" liest, meldet
     * sich an und findet nichts. Das ist die teuerste Art, es zu
     * erfahren — und die einzige, die auch noch wie ein Fehler
     * aussieht.
     */
    const l = lageFuer("PT");
    expect(l.markt).toBe("keiner");
    expect(l.nettoRechnung).toBe(false);
    expect(l.hinweis).toMatch(/keine Stellenquellen/);
    // Und trotzdem ein Weg: eigene Links prüfen lassen geht überall.
    expect(l.hinweis).toMatch(/eigene Stellenlinks/);
  });

  it("nennt den Ländernamen und nicht den Code", () => {
    // „Für PT haben wir keine Quellen" liest sich wie eine
    // Fehlermeldung aus einem Protokoll.
    expect(lageFuer("PT").hinweis).toMatch(/Portugal/);
    expect(lageFuer("CH").hinweis).toMatch(/Schweiz/);
  });

  it("fällt bei unbekannter Währung auf Euro zurück", () => {
    // Lieber der häufigste Fall als `undefined` in einer Anzeige.
    expect(lageFuer("ZZ").waehrung).toBe("EUR");
  });
});

describe("Was NICHT passiert", () => {
  it("rechnet keine Beispielzahlen in Landeswährung um", () => {
    /*
     * Bewusst festgehalten.
     *
     * Aus „53.000 €" würde „53.000 CHF" — dieselbe Zahl, ein anderes
     * Zeichen, und damit eine Behauptung über das Schweizer Lohnniveau,
     * die niemand geprüft hat. Ein Wechselkurs wäre auch keine Lösung:
     * Löhne folgen keinem Wechselkurs.
     *
     * Diese Datei liefert deshalb NUR die Währung als Angabe — kein
     * Betrag, kein Faktor, keine Umrechnung. Wenn jemand später einen
     * einbaut, soll er hier vorbeikommen.
     */
    const l = lageFuer("CH");
    expect(Object.keys(l).sort()).toEqual(
      ["code", "hinweis", "markt", "nettoRechnung", "waehrung"].sort(),
    );
  });
});

describe("Deutsch, das nicht nach Maschine klingt", () => {
  it("setzt den Artikel, wo das Deutsche einen verlangt", () => {
    /*
     * `Intl.DisplayNames` liefert „Schweiz", nicht „die Schweiz". In
     * einer Aufzählung ist das richtig, in einem Satz falsch — „Für
     * Schweiz haben wir Stellen" liest sich wie eine maschinelle
     * Übersetzung, und genau daran erkennt man sie.
     */
    expect(lageFuer("CH").hinweis).toMatch(/Für die Schweiz/);
    expect(lageFuer("NL").hinweis).toMatch(/Für die Niederlande/);
    expect(lageFuer("US").hinweis).toMatch(/Für die USA/);
  });

  it("lässt ihn weg, wo keiner hingehört", () => {
    expect(lageFuer("PT").hinweis).toMatch(/Für Portugal/);
    expect(lageFuer("AT").hinweis).toMatch(/Für Österreich/);
  });
});
