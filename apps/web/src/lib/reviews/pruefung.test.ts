import { describe, expect, it } from "vitest";
import { initialen, pruefeBewertung, MIN_TEXT } from "./pruefung.ts";

/**
 * Was eine Bewertung erfüllen muss.
 *
 * Diese Regeln stehen an drei Stellen: im Formular (Höflichkeit), hier
 * (die Prüfung) und als `CHECK` in der Datenbank (die letzte Instanz).
 * Geprüft wird hier die mittlere — die einzige, die auch dann greift,
 * wenn jemand das Formular umgeht.
 */

const GUELTIG = {
  displayName: "Beispiel Person",
  rating: "5",
  body: "Monday hat mir geholfen, meine Erfahrung überhaupt erst zu sortieren. Sehr hilfreich.",
  consentPublish: "on",
  consentPrivacy: "on",
};

describe("Gültige Bewertungen", () => {
  it("nimmt eine vollständige Eingabe an", () => {
    const r = pruefeBewertung(GUELTIG);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.wert.rating).toBe(5);
      expect(r.wert.displayName).toBe("Beispiel Person");
    }
  });

  it("nimmt die freiwilligen Felder als null, wenn sie leer sind", () => {
    const r = pruefeBewertung(GUELTIG);
    expect(r.ok && r.wert.headline).toBeNull();
    expect(r.ok && r.wert.roleOrCompany).toBeNull();
    expect(r.ok && r.wert.contactEmail).toBeNull();
  });
});

describe("Pflichtfelder", () => {
  it("verlangt einen Namen", () => {
    const r = pruefeBewertung({ ...GUELTIG, displayName: " " });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.fehler.some((f) => f.feld === "displayName")).toBe(true);
  });

  it("verlangt eine Sternebewertung zwischen 1 und 5", () => {
    for (const wert of ["0", "6", "", "drei", "3.5"]) {
      const r = pruefeBewertung({ ...GUELTIG, rating: wert });
      expect(r.ok, `rating=${wert}`).toBe(false);
    }
  });

  it(`verlangt mindestens ${MIN_TEXT} Zeichen Text`, () => {
    const r = pruefeBewertung({ ...GUELTIG, body: "Gut." });
    expect(r.ok).toBe(false);
    // Die Meldung nennt die aktuelle Länge — sonst rät die Person.
    expect(!r.ok && r.fehler.find((f) => f.feld === "body")?.text).toMatch(/aktuell 4/);
  });

  it("verlangt beide Zustimmungen", () => {
    /*
     * Die wichtigste Prüfung in dieser Datei.
     *
     * Ohne ausdrückliche Zustimmung wird nichts veröffentlicht. Das
     * steht zusätzlich als Bedingung in der Datenbank — hier fällt es
     * auf, bevor die Zeile überhaupt entsteht.
     */
    expect(pruefeBewertung({ ...GUELTIG, consentPublish: undefined }).ok).toBe(false);
    expect(pruefeBewertung({ ...GUELTIG, consentPrivacy: undefined }).ok).toBe(false);
  });
});

describe("Spam und Unsinn", () => {
  it("lehnt ab, wenn der Honigtopf gefüllt ist", () => {
    // Das Feld ist im Formular für Menschen nicht erreichbar. Ist es
    // gefüllt, war es ein Automat.
    const r = pruefeBewertung({ ...GUELTIG, website: "https://beispiel.invalid" });
    expect(r.ok).toBe(false);
  });

  it("prüft die E-Mail-Adresse nur, wenn eine angegeben ist", () => {
    expect(pruefeBewertung({ ...GUELTIG, contactEmail: "" }).ok).toBe(true);
    expect(pruefeBewertung({ ...GUELTIG, contactEmail: "keine-adresse" }).ok).toBe(false);
    expect(pruefeBewertung({ ...GUELTIG, contactEmail: "a@b.de" }).ok).toBe(true);
  });

  it("entfernt unsichtbare Steuerzeichen", () => {
    /*
     * Nicht gegen Cross-Site-Scripting — dagegen hilft React. Sondern
     * gegen Zeichen, die die Leserichtung kippen: ein einziges davon in
     * einer Bewertung zerlegt die Darstellung aller anderen daneben.
     */
    const r = pruefeBewertung({
      ...GUELTIG,
      displayName: "Beispiel‮Person",
      body: `Ein ganz normaler Text mit einem​ unsichtbaren Zeichen darin, lang genug.`,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.wert.displayName).not.toMatch(/[‪-‮]/);
      expect(r.wert.body).not.toMatch(/[​-‏]/);
    }
  });

  it("begrenzt die Länge nach oben", () => {
    expect(pruefeBewertung({ ...GUELTIG, body: "x".repeat(5001) }).ok).toBe(false);
    expect(pruefeBewertung({ ...GUELTIG, displayName: "x".repeat(81) }).ok).toBe(false);
    expect(pruefeBewertung({ ...GUELTIG, headline: "x".repeat(121) }).ok).toBe(false);
  });

  it("sammelt alle Fehler statt nur des ersten", () => {
    // Eine Person soll nicht dreimal absenden müssen, um drei Fehler zu
    // erfahren.
    const r = pruefeBewertung({ displayName: "", rating: "9", body: "kurz" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.fehler.length).toBeGreaterThanOrEqual(4);
  });
});

describe("Initialen", () => {
  it("nimmt den ersten und letzten Namensteil", () => {
    expect(initialen("Beispiel Person")).toBe("BP");
    expect(initialen("Anna Maria Schmidt")).toBe("AS");
  });

  it("kommt mit einem einzelnen Namen zurecht", () => {
    expect(initialen("Kim")).toBe("KI");
  });

  it("erfindet nichts bei leerem Namen", () => {
    expect(initialen("")).toBe("?");
  });
});
