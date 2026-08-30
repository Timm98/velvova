import { describe, expect, it } from "vitest";
import {
  canonicalKey,
  isSameJob,
  normaliseCompany,
  normaliseLocation,
  normaliseTitle,
} from "./canonical.ts";

/**
 * Die Beispiele stammen aus dem, was Portale tatsächlich schreiben —
 * nicht aus dem, was ein Schema vorsieht.
 */

describe("Titel", () => {
  it("entfernt die Geschlechtsangabe in ihren Schreibweisen", () => {
    const erwartet = "fachkraft lagerlogistik";
    for (const variante of [
      "Fachkraft Lagerlogistik (m/w/d)",
      "Fachkraft Lagerlogistik m/w/d",
      "Fachkraft Lagerlogistik (w/m/d)",
      "Fachkraft Lagerlogistik [all genders]",
      "Fachkraft Lagerlogistik (gn)",
      // Aus echten Arbeitnow-Daten, beim ersten Lauf gefunden:
      "Fachkraft Lagerlogistik (f/m/d)",
      "Fachkraft Lagerlogistik m/f/x",
      "Fachkraft Lagerlogistik (divers)",
    ]) {
      expect(normaliseTitle(variante)).toBe(erwartet);
    }
  });

  it("entfernt den Beschäftigungsumfang", () => {
    expect(normaliseTitle("Pflegefachkraft Vollzeit")).toBe("pflegefachkraft");
    expect(normaliseTitle("Pflegefachkraft (Teilzeit)")).toBe("pflegefachkraft");
  });

  it("hält verschiedene Stellen auseinander", () => {
    expect(normaliseTitle("Softwareentwickler Backend")).not.toBe(
      normaliseTitle("Softwareentwickler Frontend"),
    );
  });
});

describe("Unternehmen", () => {
  it("ignoriert die Rechtsform", () => {
    expect(normaliseCompany("Muster GmbH")).toBe(normaliseCompany("Muster"));
    expect(normaliseCompany("Muster GmbH & Co. KG")).toBe(normaliseCompany("Muster"));
    expect(normaliseCompany("Muster AG")).toBe(normaliseCompany("muster"));
  });

  it("hält verschiedene Unternehmen auseinander", () => {
    expect(normaliseCompany("Muster GmbH")).not.toBe(normaliseCompany("Musterle GmbH"));
  });
});

describe("Ort", () => {
  it("führt Schreibweisen derselben Stadt zusammen", () => {
    const erwartet = "hamburg";
    expect(normaliseLocation("Hamburg")).toBe(erwartet);
    expect(normaliseLocation("Hamburg, Deutschland")).toBe(erwartet);
    expect(normaliseLocation("22765 Hamburg")).toBe(erwartet);
  });

  it("hält verschiedene Städte auseinander", () => {
    expect(normaliseLocation("Hamburg")).not.toBe(normaliseLocation("Hameln"));
  });
});

describe("Zusammenführung", () => {
  const anzeige = {
    title: "Fachkraft Lagerlogistik (m/w/d)",
    companyName: "Muster Logistik GmbH",
    location: "22765 Hamburg",
  };

  it("erkennt dieselbe Stelle über Portale hinweg", () => {
    expect(
      isSameJob(anzeige, {
        title: "Fachkraft Lagerlogistik w/m/d Vollzeit",
        companyName: "Muster Logistik",
        location: "Hamburg, Deutschland",
      }),
    ).toBe(true);
  });

  it("trennt bei abweichendem Ort", () => {
    expect(isSameJob(anzeige, { ...anzeige, location: "Bremen" })).toBe(false);
  });

  it("trennt bei abweichendem Unternehmen", () => {
    expect(isSameJob(anzeige, { ...anzeige, companyName: "Andere Logistik GmbH" })).toBe(false);
  });

  it("fasst nicht zusammen, wenn ein Bestandteil fehlt", () => {
    // Zwei unbekannte Schlüssel sind nicht derselbe Schlüssel. Wer das
    // gleichsetzt, wirft alle unvollständigen Anzeigen auf einen Haufen.
    const ohneFirma = { ...anzeige, companyName: "" };
    expect(canonicalKey(ohneFirma)).toBeNull();
    expect(isSameJob(ohneFirma, { ...anzeige, companyName: "   " })).toBe(false);
  });

  it("wirft im Zweifel nicht zusammen", () => {
    // Der teure Fehler ist das Verschlucken einer echten Möglichkeit:
    // er ist unsichtbar. Eine zu lange Liste sieht man.
    expect(
      isSameJob(
        { title: "Pflegefachkraft", companyName: "Klinikum Nord", location: "Hamburg" },
        { title: "Pflegefachkraft Intensiv", companyName: "Klinikum Nord", location: "Hamburg" },
      ),
    ).toBe(false);
  });
});
