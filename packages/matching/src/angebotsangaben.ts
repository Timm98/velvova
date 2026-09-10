import type { Gehaltsangabe, Stellenangaben } from "./suchkriterien.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Ein Angebot als Stelle lesen
 * ══════════════════════════════════════════════════════════════════
 *
 * Ein Betrieb hinterlegt auf `/business/bedarf` in einem Absatz, wen
 * er sofort nehmen würde. Daraus wird ein Angebot mit verbindlichen
 * Konditionen und einer Frist.
 *
 * Bis heute wurde es geschrieben und von niemandem gelesen. Der
 * nächtliche Lauf rechnet gegen `jobs` — der Betrieb konnte ein
 * Angebot hinterlegen, und es passierte nichts damit. Genau der
 * Defekt, der in CLAUDE.md als häufigster steht.
 *
 * ── Warum hier übersetzt und nicht zweitgerechnet wird ──────────
 *
 * Die Muss-Prüfung (`kriteriumPruefen`) ist die eine Rechnung, die
 * entscheidet, ob etwas zu jemandem passt. Ein Angebot durch eine
 * zweite Prüfung zu schicken hiesse, zwei Rechnungen zu haben, die
 * auseinanderlaufen — beim ersten Mal, wenn eine von beiden eine
 * Regel bekommt, die die andere nicht hat. Deshalb wird das Angebot
 * in die Form gebracht, die die vorhandene Prüfung liest.
 *
 * ── Die drei Unterschiede zu einer Anzeige ──────────────────────
 *
 *   Das Gehalt ist zugesagt.  Bei einer Anzeige ist „bis zu 50.000"
 *                             keine Zusage. Ein Angebot ist eine, und
 *                             deshalb steht `garantiert` auf true —
 *                             das ist der ganze Unterschied zwischen
 *                             einem Angebot und einer Anzeige.
 *   Der Arbeitgeber ist ein   Vor dem Aufdecken steht dort die
 *   Umriss.                   anonyme Beschreibung („Träger im Osten
 *                             der Stadt"), nie der Name.
 *   Was nicht gesagt wurde,   Ein Angebot hat keinen Fliesstext, aus
 *   ist `null`.               dem sich etwas herauslesen liesse. Was
 *                             fehlt, bleibt unbekannt — und eine
 *                             unbekannte Muss-Angabe ist weder
 *                             erfüllt noch verletzt.
 */

export interface Angebotszeile {
  rollenprofil: { rolle?: string | null; anforderungen?: string[] };
  konditionen: {
    gehaltVon?: number | null;
    gehaltBis?: number | null;
    arbeitszeit?: string | null;
    ort?: string | null;
    befristung?: string | null;
  };
  anonymBeschreibung: string;
}

/** „vollzeit" → 40, „teilzeit 30" → 30. Was nicht dasteht, bleibt `null`. */
export function wochenstundenAusText(text: string | null | undefined): number | null {
  if (!text) return null;
  const zahl = /(\d{1,2})\s*(std|stunden|h\b)/i.exec(text);
  if (zahl) {
    const n = Number(zahl[1]);
    if (n >= 1 && n <= 60) return n;
  }
  if (/vollzeit/i.test(text)) return 40;
  /*
   * „Teilzeit" ohne Zahl ist keine Stundenangabe.
   *
   * Sie auf 20 zu runden wäre eine Behauptung über einen Vertrag, den
   * niemand gesehen hat — und sie würde eine Muss-Prüfung bestehen
   * oder scheitern lassen, die eigentlich „unbekannt" lauten müsste.
   */
  return null;
}

/** „unbefristet" → false, „befristet …" → true, sonst `null`. */
export function befristungAusText(text: string | null | undefined): boolean | null {
  if (!text) return null;
  if (/unbefristet/i.test(text)) return false;
  if (/befristet|befristung/i.test(text)) return true;
  return null;
}

/**
 * Das Angebot in der Form, die die Muss-Prüfung liest.
 *
 * `land` steht fest auf „DE": Angebote entstehen heute nur über das
 * deutsche Arbeitgeber-Dashboard. Sobald das nicht mehr stimmt, muss
 * es aus dem Angebot kommen — und bis dahin ist eine feste Angabe
 * ehrlicher als ein geratenes Feld.
 */
export function angebotAlsStelle(a: Angebotszeile): Stellenangaben {
  const gehalt: Gehaltsangabe | null =
    a.konditionen.gehaltVon != null || a.konditionen.gehaltBis != null
      ? {
          min: a.konditionen.gehaltVon ?? null,
          max: a.konditionen.gehaltBis ?? null,
          waehrung: "EUR",
          zeitraum: "month",
          /* Der ganze Unterschied zu einer Anzeige. */
          garantiert: true,
          basis: "brutto",
          herkunft: "employer",
          beleg: "Verbindliches Angebot des Arbeitgebers",
        }
      : null;

  const stunden = wochenstundenAusText(a.konditionen.arbeitszeit);

  return {
    titel: a.rollenprofil.rolle ?? "",
    /* Vor dem Aufdecken ein Umriss, nie ein Name. */
    arbeitgeber: a.anonymBeschreibung,
    ort: a.konditionen.ort ?? null,
    land: "DE",
    arbeitsmodell: null,
    remoteAnteil: null,
    vertragsform: null,
    befristet: befristungAusText(a.konditionen.befristung),
    wochenstunden: stunden,
    schichtarbeit: null,
    reiseanteil: null,
    erfahrungsniveau: null,
    gehalt,
    weitereGehaelter: [],
    aufgaben: [],
    anforderungen: a.rollenprofil.anforderungen ?? [],
    /*
     * Die Wortmenge ist das, was der Betrieb gesagt hat — Rolle und
     * Anforderungen. Kein Fliesstext, keine Benefits, keine
     * Beschreibung: Ein Angebot ist kürzer als eine Anzeige, und das
     * ist kein Mangel.
     */
    wortmenge: [a.rollenprofil.rolle ?? "", ...(a.rollenprofil.anforderungen ?? [])]
      .join(" ")
      .toLowerCase(),
    lizenzen: [],
    sprachen: {},
    pendelminuten: null,
    entfernungKm: null,
    breitengrad: null,
    laengengrad: null,
  };
}
