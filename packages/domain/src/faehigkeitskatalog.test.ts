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
     * Ein Abgleich ausserhalb der geprüften Felder soll nicht
     * aussehen, als sei er geprüft worden.
     */
    for (const k of KATALOG) expect(["pflege", "lager"]).toContain(k.feld);
  });

  it("deckt beide Felder ab", () => {
    /*
     * Der Katalog folgt den Nutzern, nicht dem Markt: Der erste Lauf
     * gegen 142 bestätigte Belege ergab null Fähigkeiten, weil kein
     * einziger Beleg Pflegebezug hatte.
     */
    expect(KATALOG.some((k) => k.feld === "pflege")).toBe(true);
    expect(KATALOG.some((k) => k.feld === "lager")).toBe(true);
  });

  it("findet die Fähigkeiten aus den echten Belegen im Bestand", () => {
    expect(schluesselFinden("Ladungssicherung nach VDI 2700")).toBe("ladungssicherung");
    expect(schluesselFinden("Kommissionierung nach Pickliste, zuletzt zwei Jahre täglich")).toBe("kommissionierung");
    expect(schluesselFinden("Warenannahme und Wareneingangskontrolle")).toBe("warenannahme");
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

  it("trifft nicht mitten in einem anderen Wort", () => {
    /*
     * Der Fehler, der 19 falsche Zeilen in der Produktion erzeugt hat:
     * „its" traf „Arbe-its-probe", und neunzehn Menschen bekamen die
     * Fähigkeit Intensivpflege aus einem Satz über eine Arbeitsprobe.
     */
    expect(schluesselFinden("Arbeitsprobe „Was dir Energie gibt“")).toBeNull();
    expect(schluesselFinden("Die Arbeitsprobe hat sie gelöst")).toBeNull();
  });

  it("findet den Stamm am Anfang eines Kompositums", () => {
    /* Deutsche Komposita tragen ihn vorn, nie mitten im Wort. */
    expect(schluesselFinden("Dienstplangestaltung")).toBe("dienstplanung");
    expect(schluesselFinden("Hygienebeauftragte der Station")).toBe("hygiene");
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
