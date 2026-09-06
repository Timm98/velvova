import { describe, expect, it } from "vitest";
import { widersprueche, type Zusagenangabe } from "./widersprueche.ts";

/**
 * Der vierte Kasten.
 *
 * ── Was hier geschützt wird ───────────────────────────────────
 *
 * Einen Widerspruch zu behaupten, wo keiner ist, wäre schlimmer als
 * ihn zu übersehen: Der Mensch ginge mit einer erfundenen Frage ins
 * Gespräch und verlöre Vertrauen in die übrigen Angaben.
 */

const a = (punkt: Zusagenangabe["punkt"], zusage: string, herkunft: Zusagenangabe["herkunft"]): Zusagenangabe =>
  ({ punkt, zusage, herkunft, beleg: "" });

describe("Der Fall, um den es geht", () => {
  it("erkennt Anzeige gegen Gespräch", () => {
    /*
     * In der Anzeige steht Homeoffice ab Tag eins. Im Gespräch heisst
     * es, das gehe erst nach der Probezeit. Beides klingt für sich
     * plausibel — der Widerspruch fällt sonst im vierten Monat auf.
     */
    const w = widersprueche([
      a("homeoffice", "Homeoffice ab Tag eins", "anzeige"),
      a("homeoffice", "Homeoffice erst nach der Probezeit", "gespraech"),
    ]);
    expect(w).toHaveLength(1);
    expect(w[0]!.erklaerung).toContain("Kläre vor der Unterschrift");
  });

  it("stellt die belastbarere Aussage vorn", () => {
    /*
     * Was auf Nachfrage bestätigt wurde, wiegt schwerer als eine
     * Anzeigenaussage — und steht deshalb als `staerker` da.
     */
    const w = widersprueche([
      a("arbeitszeit", "keine Überstunden", "anzeige"),
      a("arbeitszeit", "Überstunden gehören dazu", "arbeitgeber_bestaetigt"),
    ]);
    expect(w[0]!.staerker.herkunft).toBe("arbeitgeber_bestaetigt");
    expect(w[0]!.schwaecher.herkunft).toBe("anzeige");
  });

  it("erkennt verschiedene Zahlen", () => {
    const w = widersprueche([
      a("homeoffice", "zwei Tage je Woche", "anzeige"),
      a("homeoffice", "1 Tag je Woche", "gespraech"),
    ]);
    expect(w).toHaveLength(1);
  });
});

describe("Was kein Widerspruch ist, wird keiner", () => {
  it("hält zwei Formulierungen desselben Inhalts nicht dagegen", () => {
    expect(
      widersprueche([
        a("einarbeitung", "vier Wochen Einarbeitung", "anzeige"),
        a("einarbeitung", "Einarbeitung über 4 Wochen", "gespraech"),
      ]),
    ).toEqual([]);
  });

  it("vergleicht nicht innerhalb derselben Quelle", () => {
    /*
     * Zwei Notizen aus demselben Gespräch, die unterschiedlich
     * klingen, sind meistens zwei Formulierungen — kein Widerspruch
     * zwischen Anzeige und Zusage.
     */
    expect(
      widersprueche([
        a("homeoffice", "ab Tag eins", "gespraech"),
        a("homeoffice", "erst nach der Probezeit", "gespraech"),
      ]),
    ).toEqual([]);
  });

  it("hält verschiedene Punkte auseinander", () => {
    expect(
      widersprueche([
        a("homeoffice", "ab Tag eins", "anzeige"),
        a("weiterbildung", "erst nach der Probezeit", "gespraech"),
      ]),
    ).toEqual([]);
  });

  it("schweigt bei einer einzigen Angabe", () => {
    expect(widersprueche([a("gehalt", "54.000 €", "vertrag")])).toEqual([]);
  });

  it("hält eine überlappende Zahl nicht für einen Widerspruch", () => {
    /* „2 Tage, 60 %" gegen „2 Tage" nennt dieselbe Zahl. */
    expect(
      widersprueche([
        a("aufgaben", "2 Tage Beratung, 60 % des Tages", "anzeige"),
        a("aufgaben", "2 Tage Beratung", "gespraech"),
      ]),
    ).toEqual([]);
  });
});
