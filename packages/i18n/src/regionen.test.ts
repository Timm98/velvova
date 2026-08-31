import { describe, expect, it } from "vitest";
import { länder, landName, zeitzonen, währungen, währungName, zeitzoneMitVersatz } from "./regionen.ts";
import { alleSprachstände, istLocaleCode, ninaSprachen, nutzbareUiSprachen, sprachstand, LOCALES } from "./supported-locales.ts";

describe("Länder", () => {
  it("ist keine Liste mit nur Deutschland, Österreich und der Schweiz", () => {
    // Die ausdrückliche Anforderung aus §20.4. Weniger als 200 Länder
    // hiesse, dass gefiltert wurde, wo nicht gefiltert werden darf.
    expect(länder("de").length).toBeGreaterThan(200);
  });

  it("nennt Länder in der Sprache der Oberfläche", () => {
    expect(landName("FR", "de")).toBe("Frankreich");
    expect(landName("FR", "en")).toBe("France");
    expect(landName("DE", "fr")).toBe("Allemagne");
  });

  it("lässt Zusammenschlüsse und Testcodes weg", () => {
    const codes = new Set(länder("de").map((l) => l.code));
    // „Europäische Union" ist kein Arbeitsort, „ZZ" kein Land.
    for (const kein of ["EU", "ZZ", "QO", "XA", "UN"]) {
      expect(codes.has(kein), `${kein} gehört nicht in die Länderliste`).toBe(false);
    }
    for (const echt of ["DE", "UA", "TR", "BR", "JP", "ZA"]) {
      expect(codes.has(echt), `${echt} fehlt`).toBe(true);
    }
  });

  it("sortiert nach der Sprache, nicht nach Bytes", () => {
    // Im Deutschen steht Ägypten vor Albanien; ein reiner
    // Bytevergleich sortierte es ans Ende.
    const namen = länder("de").map((l) => l.name);
    const ägypten = namen.indexOf("Ägypten");
    const zypern = namen.indexOf("Zypern");
    expect(ägypten).toBeGreaterThanOrEqual(0);
    expect(ägypten).toBeLessThan(zypern);
  });
});

describe("Zeitzonen und Währungen", () => {
  it("liefert die volle IANA-Liste", () => {
    const z = zeitzonen();
    expect(z.length).toBeGreaterThan(300);
    for (const zone of ["Europe/Berlin", "America/New_York", "Asia/Tokyo", "Africa/Cairo"]) {
      expect(z, `${zone} fehlt`).toContain(zone);
    }
  });

  it("zeigt den aktuellen Versatz an", () => {
    const text = zeitzoneMitVersatz("Europe/Berlin", "de", new Date("2026-08-31T12:00:00Z"));
    expect(text).toContain("Europe/Berlin");
    // CLDR schreibt den Versatz je nach Sprache „GMT+2" oder „UTC+2".
    // Beides ist richtig; festzulegen, welches, wäre eine Erfindung.
    expect(text).toMatch(/(GMT|UTC)[+-]\d/);
  });

  it("liefert ISO-4217-Währungen mit Namen", () => {
    const w = währungen();
    expect(w.length).toBeGreaterThan(100);
    for (const code of ["EUR", "USD", "PLN", "TRY", "UAH"]) {
      expect(w, `${code} fehlt`).toContain(code);
    }
    expect(währungName("EUR", "de")).toContain("EUR");
    expect(währungName("EUR", "de")).toContain("Euro");
  });
});

describe("Sprachregistry", () => {
  it("führt die zwölf Sprachen aus der Vorgabe", () => {
    const codes = LOCALES.map((l) => l.code);
    for (const c of ["de","en","fr","es","it","nl","pl","pt","tr","uk","ar","ru"]) {
      expect(codes, `${c} fehlt`).toContain(c);
    }
  });

  it("behauptet keine Unterstützung, die es nicht gibt", () => {
    /*
     * Der Kern von §20.3. Eine Sprache ohne Katalog muss „geplant"
     * sein — und darf deshalb nicht in der Auswahl der
     * Oberflächensprachen auftauchen.
     */
    expect(sprachstand("fr").zustand).toBe("geplant");
    expect(sprachstand("ar").zustand).toBe("geplant");

    const nutzbar = nutzbareUiSprachen().map((l) => l.code);
    expect(nutzbar).toContain("de");
    expect(nutzbar).toContain("en");
    expect(nutzbar, "Französisch hat keine Texte und darf nicht wählbar sein").not.toContain("fr");
  });

  it("misst den Zustand, statt ihn einzutragen", () => {
    // Deutsch ist die Referenz und deshalb per Definition vollständig;
    // Englisch muss es aus eigener Kraft sein.
    expect(sprachstand("de").zustand).toBe("vollständig");
    expect(sprachstand("de").abdeckung).toBe(1);
    expect(
      sprachstand("en").zustand,
      `Englisch fehlen ${sprachstand("en").fehlende} Texte`,
    ).toBe("vollständig");
  });

  it("kennt die Schreibrichtung", () => {
    expect(LOCALES.find((l) => l.code === "ar")!.richtung).toBe("rtl");
    expect(LOCALES.find((l) => l.code === "de")!.richtung).toBe("ltr");
  });

  it("sortiert vollständige Sprachen vor Beta und Geplant", () => {
    const stände = alleSprachstände();
    const ersteGeplant = stände.findIndex((s) => s.zustand === "geplant");
    const letzteVollständig = stände.map((s) => s.zustand).lastIndexOf("vollständig");
    expect(letzteVollständig).toBeLessThan(ersteGeplant);
  });
});

describe("Trennung der drei Sprachwerte (§20.1)", () => {
  it("erlaubt für Nina mehr Sprachen als für die Oberfläche", () => {
    /*
     * Die Regel, die dreimal fest verdrahtet war — in der Auswahlliste,
     * im Datenbanktyp und in der Formularprüfung. Zweimal davon still:
     * die Seite bot Türkisch an, die Prüfung verwarf es kommentarlos,
     * und nach dem Neuladen stand wieder Deutsch da.
     */
    expect(ninaSprachen().length).toBe(12);
    expect(nutzbareUiSprachen().length).toBeLessThan(ninaSprachen().length);
  });

  it("hält jede Nina-Sprache für gültig, jede Oberflächensprache aber nicht", () => {
    expect(istLocaleCode("tr")).toBe(true);
    expect(istLocaleCode("uk")).toBe(true);
    expect(istLocaleCode("klingon")).toBe(false);

    const ui = new Set(nutzbareUiSprachen().map((l) => l.code));
    expect(ui.has("tr"), "Türkisch hat keine Oberflächentexte").toBe(false);
  });
});
