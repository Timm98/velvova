import { describe, expect, it } from "vitest";
import { volltextErlaubt } from "./policy-engine.ts";
import { SOURCE_REGISTRY } from "./source-registry.ts";

describe("volltextErlaubt", () => {
  it("verweigert den Volltext bei Aggregatoren, die Ausschnitte liefern", () => {
    /*
     * Jooble liefert Ausschnitte fremder Anzeigen. Die Registry sagt es
     * mit eigenem Kommentar — die Stellenseite zeigte den Text
     * trotzdem, unter „Vollständige Stellenbeschreibung".
     */
    expect(volltextErlaubt("jooble_de")).toBe(false);
    expect(volltextErlaubt("adzuna_de")).toBe(false);
    expect(volltextErlaubt("bundesagentur")).toBe(false);
  });

  it("behandelt eine unbekannte Quelle als nicht erlaubt", () => {
    /* Keine hinterlegte Regel ist keine Erlaubnis. */
    expect(volltextErlaubt("gibt-es-nicht")).toBe(false);
    expect(volltextErlaubt(null)).toBe(false);
    expect(volltextErlaubt(undefined)).toBe(false);
  });

  it("erlaubt den Volltext nie ohne die hinterlegte Erlaubnis", () => {
    /* Die Antwort darf die Regel nie lockern — nur verschärfen. */
    for (const e of SOURCE_REGISTRY) {
      if (volltextErlaubt(e.providerKey)) {
        expect(e.fullTextAllowed, e.providerKey).toBe(true);
        expect(e.allowedFields, e.providerKey).toContain("description_text");
      }
    }
  });

  it("liest den Widerspruch bei usajobs in die enge Richtung", () => {
    /*
     * `fullTextAllowed: true`, aber nur `description_summary` unter den
     * erlaubten Feldern. Was nicht gespeichert werden darf, kann nicht
     * wörtlich erscheinen. Die hinterlegte Regel bleibt unverändert —
     * eine rechtliche Angabe lockert man nicht, weil sie unbequem ist.
     */
    expect(volltextErlaubt("usajobs")).toBe(false);
  });

  it("lässt den Volltext bei den eigenen Kanälen zu", () => {
    /* Direkt vom Arbeitgeber und eigener Import: da gehört er hin. */
    expect(volltextErlaubt("ats_greenhouse")).toBe(true);
    expect(volltextErlaubt("arbeitnow")).toBe(true);
  });
});
