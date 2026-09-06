import { describe, expect, it } from "vitest";
import { beschreibungsTokens, computeFit, DEFAULT_FIT_WEIGHTS } from "./fit.ts";
import { computeListingConfidence } from "./listingConfidence.ts";
import { makeConstraints, makeEvidence, makeJob, makeRequirements } from "./fixtures.ts";

/**
 * Die Vorberechnung darf keinen einzigen Wert verschieben.
 *
 * Die Ranglistenabfrage lädt seit dem zweistufigen Umbau nicht mehr den
 * Beschreibungstext, sondern seine vorverdaute Wortmenge. Die Begründung
 * dafür ist eine Behauptung über `overlap()`: dass es vom Fliesstext
 * ohnehin nur `wortmenge()` sieht, und die Vorwegnahme deshalb kein
 * Näherungsverfahren ist, sondern dieselbe Rechnung in anderer
 * Reihenfolge.
 *
 * Diese Datei prüft die Behauptung. Bricht sie, ist entweder `overlap()`
 * feiner geworden — Häufigkeit, Reihenfolge, Wortlänge — oder
 * `beschreibungsTokens()` gröber. In beiden Fällen wäre die Rangfolge
 * still eine andere geworden, und genau das soll hier nicht unbemerkt
 * durchgehen.
 */

const BASIS = {
  weights: DEFAULT_FIT_WEIGHTS,
  constraints: makeConstraints(),
  requirements: makeRequirements(),
  evidence: makeEvidence(),
  energisingTasks: ["Kundinnen betreuen", "Schulungen präsentieren", "Berichte erstellen"],
  drainingTasks: ["Nächtliche Rufbereitschaft", "Kaltakquise am Telefon"],
  workStylePreferences: [
    "eigenständig priorisieren",
    "viel Austausch im Team",
    "enge Zusammenarbeit mit dem Produkt",
  ],
  rankedValues: ["Weiterbildung", "flexible Arbeitszeit", "Lernbudget"],
  statedInterests: ["Kundenkontakt"],
};

/** Realistische Anzeigentexte — nicht drei Wörter, sondern Fliesstext. */
const TEXTE = [
  "Du begleitest unsere Kundinnen und Kunden nach dem Start. Du arbeitest eng " +
    "mit Produkt und Support zusammen, priorisierst eigenstaendig und hast viel " +
    "Austausch im Team. Wir bieten Weiterbildung, flexible Arbeitszeit und ein " +
    "festes Lernbudget.",
  "Als Teil eines kleinen Teams verantwortest du die Betreuung unserer " +
    "Bestandskunden. Enge Zusammenarbeit mit dem Produkt ist bei uns kein " +
    "Schlagwort: du sitzt in den Planungsrunden. Weiterbildung wird bezahlt, " +
    "die Arbeitszeit ist flexibel, und es gibt ein Lernbudget von 1.500 EUR.",
  "WIR SUCHEN DICH!!! Kundenbetreuung (m/w/d) — 100% Remote möglich. " +
    "Eigenständiges Priorisieren gehört dazu; Austausch im Team ebenso. " +
    "Benefits: Weiterbildung, flexible Arbeitszeit, Lernbudget, Obstkorb.",
  "",
];

describe("Vorberechnete Beschreibung", () => {
  it("liefert denselben Passungswert wie der volle Text", () => {
    for (const text of TEXTE) {
      const ausText = computeFit({ job: makeJob({ description: text, descriptionTokens: text }), ...BASIS });
      /*
       * `description: null` ist hier der eigentliche Punkt.
       *
       * Stünde der Text auch auf dieser Seite, würde der Test ihn
       * klaglos bestehen, selbst wenn `computeFit` heimlich wieder den
       * Fliesstext läse — beide Seiten hätten dann dasselbe gelesen.
       * So sieht die Stelle aus, wie sie aus der Ranglistenabfrage
       * kommt: ohne Text. Greift die Bewertung doch danach, fällt der
       * Wert auseinander und der Test bricht.
       */
      const ausTokens = computeFit({
        job: makeJob({ description: null, descriptionTokens: beschreibungsTokens(text) }),
        ...BASIS,
      });
      expect(ausTokens.score, `Text: ${text.slice(0, 40)}…`).toBe(ausText.score);
      expect(ausTokens.factors).toEqual(ausText.factors);
    }
  });

  it("bleibt gleich, wenn Wörter umgestellt oder wiederholt werden", () => {
    // Der eigentliche Beleg dafür, dass `overlap()` eine Mengenoperation
    // ist: dreht man den Text um, ändert sich die Wortmenge nicht.
    const text = TEXTE[1]!;
    const umgedreht = text.split(/\s+/).reverse().join(" ");
    const doppelt = `${text} ${text}`;
    expect(beschreibungsTokens(umgedreht)).toBe(beschreibungsTokens(text));
    expect(beschreibungsTokens(doppelt)).toBe(beschreibungsTokens(text));
  });

  it("wirft kurze Wörter weg — genau die, die overlap ohnehin ignoriert", () => {
    expect(beschreibungsTokens("und der die das mit für Weiterbildung")).toBe("weiterbildung");
  });

  it("normalisiert Satzzeichen wie overlap, nicht anders", () => {
    // Punkt, Komma, Klammern und Gedankenstriche trennen Wörter; sie
    // dürfen nicht an ihnen kleben bleiben, sonst findet overlap sie nie.
    expect(beschreibungsTokens("Produkt-Team, (Support): Weiterbildung!")).toBe(
      "produkt support team weiterbildung",
    );
  });

  it("liest die Vollständigkeit aus descriptionLength, nicht aus dem Text", () => {
    const lang = "x".repeat(201);
    const mitText = computeListingConfidence({ job: makeJob({ description: lang }), source: null });
    const ohneText = computeListingConfidence({
      // So sieht eine Stelle aus der Ranglistenabfrage aus: kein Text,
      // aber die Länge ist bekannt.
      job: makeJob({ description: null, descriptionLength: lang.length }),
      source: null,
    });
    expect(ohneText.score).toBe(mitText.score);
  });
});
