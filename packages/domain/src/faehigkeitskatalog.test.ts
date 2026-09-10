import { describe, expect, it } from "vitest";
import { KATALOG, SCHLUESSEL, eintrag, schluesselFinden } from "./faehigkeitskatalog.ts";
import { anforderungAbgleichen, type Faehigkeitsaussage } from "./faehigkeiten.ts";

describe("Der Katalog selbst", () => {
  it("hat keine doppelten Schlüssel", () => {
    expect(new Set(SCHLUESSEL).size).toBe(SCHLUESSEL.length);
  });

  it("gibt jedem Eintrag mindestens ein Synonym", () => {
    for (const k of KATALOG) {
      expect(k.synonyme.length, k.schluessel).toBeGreaterThan(0);
      expect(k.bezeichnung.length, k.schluessel).toBeGreaterThan(2);
    }
  });

  it("nennt sein Berufsfeld", () => {
    /*
     * Ein Abgleich ausserhalb der Pflege soll nicht aussehen, als sei
     * er geprüft worden.
     */
    for (const k of KATALOG) expect(k.feld).toBe("pflege");
  });
});

describe("schluesselFinden", () => {
  it("findet den Eintrag in einer echten Anforderungszeile", () => {
    expect(schluesselFinden("Erfahrung in der Wundversorgung")).toBe("wundversorgung");
    expect(schluesselFinden("Sicherer Umgang mit Medikamentengabe")).toBe("medikamentengabe");
    expect(schluesselFinden("Erstellung der Dienstpläne")).toBe("dienstplanung");
  });

  it("kommt mit deutschen Komposita zurecht", () => {
    /*
     * `\bdienstplanung\b` trifft „Dienstplangestaltung" nicht. Deutsch
     * bildet Komposita, und die Anzeige schreibt sie aus.
     */
    expect(schluesselFinden("Dienstplangestaltung für die Station")).toBe("dienstplanung");
    expect(schluesselFinden("Verantwortung für das Wundmanagement")).toBe("wundversorgung");
  });

  it("lässt das längste Synonym gewinnen", () => {
    /*
     * „Praxisanleitung" enthält „anleitung". Gewönne das kürzere,
     * landete eine Praxisanleiterin unter „Einarbeitung".
     */
    expect(schluesselFinden("Praxisanleitung von Auszubildenden")).toBe("praxisanleitung");
  });

  it("gibt null zurück, wo der Katalog nichts kennt", () => {
    /* Nicht „keine Fähigkeit" — nur: der Katalog kennt sie nicht. */
    expect(schluesselFinden("Erfahrung mit Quantenkryptografie")).toBeNull();
    expect(schluesselFinden("")).toBeNull();
  });

  it("verwechselt Umlautschreibweisen nicht", () => {
    expect(schluesselFinden("Qualitätsmanagement")).toBe("qualitaetsmanagement");
    expect(schluesselFinden("Qualitaetsmanagement")).toBe("qualitaetsmanagement");
  });
});

describe("Katalog und Abgleich zusammen", () => {
  const F = (schluessel: string): Faehigkeitsaussage => ({
    schluessel,
    stufe: "routiniert",
    belegtDurch: ["b1"],
    herkunft: "arbeitsprobe",
  });

  it("belegt eine echte Anforderung aus einer echten Fähigkeit", () => {
    const e = anforderungAbgleichen(
      "Erfahrung in der Wundversorgung",
      "sicher",
      [F("wundversorgung")],
      schluesselFinden,
    );
    expect(e.stand).toBe("erfuellt");
    expect(e.schluessel).toBe("wundversorgung");
  });

  it("hält die häufigste Anforderungszeile im Bestand heraus", () => {
    /* „Bereitschaft zur Schichtarbeit" — 10.696 Mal im Bestand. */
    const e = anforderungAbgleichen(
      "Bereitschaft zur Schichtarbeit",
      "sicher",
      [F("wundversorgung")],
      schluesselFinden,
    );
    expect(e.stand).toBe("nicht_zustaendig");
  });

  it("sagt bei fehlendem Beleg nicht, dass jemand es nicht kann", () => {
    const e = anforderungAbgleichen(
      "Erfahrung in der Dialyse",
      "sicher",
      [F("wundversorgung")],
      schluesselFinden,
    );
    expect(e.stand).toBe("nicht_belegt");
  });
});

describe("eintrag", () => {
  it("gibt die Bezeichnung für die Oberfläche", () => {
    expect(eintrag("praxisanleitung")?.bezeichnung).toBe("Praxisanleitung");
    expect(eintrag("gibtesnicht")).toBeNull();
  });
});
