import { describe, expect, it } from "vitest";
import { HerkunftSchema, LINKRANG, herkunftAusArt, linkrangFuerArt } from "./herkunft.ts";

/**
 * Diese Zahlen entscheiden, wohin ein Mensch geschickt wird, wenn
 * dieselbe Stelle auf mehreren Portalen steht. Ein Fehler darin sieht
 * in der Oberfläche nach nichts aus — der Link funktioniert ja.
 */
describe("Linkrang", () => {
  it("folgt der Reihenfolge, die an HerkunftSchema dokumentiert ist", () => {
    /*
     * Der Satz dort lautet: „Je weiter oben, desto näher am
     * Arbeitgeber. Kennen wir zu einer Stelle mehrere Quellen, gewinnt
     * die oberste." Genau das prüft dieser Test — und er schlägt fehl,
     * sobald jemand das Enum umsortiert, ohne es zu meinen.
     */
    const nachRang = [...HerkunftSchema.options].sort((a, b) => LINKRANG[a] - LINKRANG[b]);
    expect(nachRang).toEqual([...HerkunftSchema.options]);
  });

  it("kennt jede Herkunft", () => {
    for (const h of HerkunftSchema.options) {
      expect(LINKRANG[h]).toBeGreaterThan(0);
    }
  });

  it("stellt die Arbeitgeberseite vor jedes Portal", () => {
    /* Die eine Grenze, die der Rang nicht überschreiten darf: Eine
       vertragliche Beziehung darf zwischen zwei Portalen entscheiden,
       aber nicht zwischen Portal und Arbeitgeber. */
    expect(LINKRANG.employer_direct).toBeLessThan(LINKRANG.licensed_partner);
    expect(LINKRANG.ats).toBeLessThan(LINKRANG.licensed_partner);
    expect(LINKRANG.ats).toBeLessThan(LINKRANG.aggregator);
  });

  it("stellt den Vertragspartner vor den blossen Sammler", () => {
    expect(LINKRANG.licensed_partner).toBeLessThan(LINKRANG.aggregator);
  });

  it("lässt Lücken für spätere Herkünfte", () => {
    const werte = HerkunftSchema.options.map((h) => LINKRANG[h]).sort((a, b) => a - b);
    for (let i = 1; i < werte.length; i++) {
      expect(werte[i]! - werte[i - 1]!).toBeGreaterThanOrEqual(2);
    }
  });

  it("übersetzt jede Quellenart in einen Rang unter dem Standardwert", () => {
    /*
     * 100 ist der Standardwert der Spalte. Läge eine bekannte Art
     * darauf oder darüber, wäre sie nicht besser als eine Zeile, die
     * nie berechnet wurde — und die Reparatur wäre wirkungslos.
     */
    const arten = ["licensed_api", "employer_feed", "partner", "user_url", "user_text", "seed"] as const;
    for (const art of arten) {
      expect(linkrangFuerArt(art)).toBeLessThan(100);
    }
  });

  it("gibt dem Arbeitgeber-Feed einen besseren Rang als der lizenzierten API", () => {
    /* Der Fall, um den es beim Zusammenführen tatsächlich geht: Die
       Stelle steht beim ATS des Arbeitgebers UND bei einem
       Aggregator. */
    expect(linkrangFuerArt("employer_feed")).toBeLessThan(linkrangFuerArt("licensed_api"));
    expect(herkunftAusArt("employer_feed")).toBe("ats");
    expect(herkunftAusArt("licensed_api")).toBe("aggregator");
  });
});
