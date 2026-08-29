import { describe, expect, it } from "vitest";
import { de } from "./messages/de.ts";
import { en } from "./messages/en.ts";
import { formatters, getTranslator, interpolate, LOCALES } from "./index.ts";

/** Sammelt alle Pfade eines verschachtelten Objekts. */
function paths(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k));
}

describe("Sprachen", () => {
  it("hat in beiden Sprachen dieselben Schlüssel", () => {
    const dePaths = paths(de).sort();
    const enPaths = paths(en).sort();
    expect(enPaths).toEqual(dePaths);
  });

  it("hat keinen leeren Text", () => {
    for (const locale of LOCALES) {
      const { t } = getTranslator(locale);
      for (const p of paths(de)) {
        expect(t(p).trim().length, `${locale}: ${p}`).toBeGreaterThan(0);
      }
    }
  });

  it("meldet einen fehlenden Schlüssel sichtbar statt still", () => {
    expect(getTranslator("de").t("gibt.es.nicht")).toContain("fehlender Text");
  });

  it("setzt Marken- und Assistenznamen ein", () => {
    const out = getTranslator("de").t("landing.subheadline");
    expect(out).not.toContain("{assistant}");
    expect(out).not.toContain("{brand}");
  });

  it("setzt eigene Werte ein", () => {
    expect(interpolate("{done} von {total}", { done: 3, total: 7 })).toBe("3 von 7");
  });

  it("lässt unbekannte Platzhalter stehen, statt sie zu verschlucken", () => {
    expect(interpolate("Hallo {unbekannt}")).toBe("Hallo {unbekannt}");
  });
});

describe("Formate", () => {
  it("formatiert Währung nach Sprache", () => {
    expect(formatters("de").currency.format(42000)).toContain("42.000");
    expect(formatters("en").currency.format(42000)).toContain("42,000");
  });

  it("formatiert Datum nach Sprache", () => {
    const d = new Date("2026-08-29T00:00:00Z");
    expect(formatters("de").date.format(d)).toContain("August");
    expect(formatters("en").date.format(d)).toContain("August");
  });
});
