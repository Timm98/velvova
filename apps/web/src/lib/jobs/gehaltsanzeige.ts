import type { Job } from "@paycheck/domain";
import { spanne } from "./geld.ts";
import { umrechnen } from "@/lib/waehrung/umrechnen";

/**
 * Wie ein Gehalt angezeigt wird — und woher es stammt.
 *
 * ── Der Fehler, der das nötig gemacht hat ─────────────────────
 *
 * An acht Stellen im Produkt stand `salary.disclosed ? … : null`. Das
 * Feld bedeutet „der Arbeitgeber hat es offengelegt" — semantisch
 * richtig, aber als ANZEIGESCHALTER falsch.
 *
 * Denn `gehalt-aus-text.ts` liest Beträge aus der Stellenbeschreibung,
 * wenn der Anbieter kein Gehaltsfeld liefert, und setzt `disclosed`
 * dabei bewusst auf `false`: Der Anbieter hat es ja nicht offengelegt.
 *
 * Gemessen am 01.09.2026: Von 1.447 Stellen tragen 71 einen Betrag —
 * **70 davon aus dem Text gelesen**, genau eine vom Anbieter. Die
 * Oberfläche zeigte also einen einzigen Betrag und schrieb 1.446 Mal
 * „nicht angegeben", obwohl in siebzig Anzeigen eine Zahl stand.
 *
 * Wir haben die Angabe geholt, richtig erkannt, in der Datenbank
 * gespeichert — und dann versteckt.
 *
 * ── Die Regel ─────────────────────────────────────────────────
 *
 * Angezeigt wird, was einen Betrag hat. Die Herkunft steht daneben,
 * unaufgefordert und in normaler Sprache. Wer eine gelesene Zahl sieht,
 * soll wissen, dass sie gelesen ist — nicht, weil wir uns absichern,
 * sondern weil der Unterschied für eine Verhandlung zählt.
 */

/**
 * Woher eine Gehaltszahl stammt — fünf Stufen, absteigend verlässlich.
 *
 * ── Warum das mehr als eine Fussnote ist ──────────────────────
 *
 * „75.000 €" und „75.000 €" sehen gleich aus und sind es nicht. Das
 * eine hat ein Arbeitgeber in seine Anzeige geschrieben, das andere hat
 * ein Portal aus Stellentitel und Region geschätzt. Wer mit der
 * zweiten Zahl in eine Verhandlung geht, verhandelt gegen eine
 * Schätzung, die niemand zugesagt hat.
 *
 * ── Der Fehler, den das behebt ────────────────────────────────
 *
 * Hier stand `salary.disclosed ? "arbeitgeber" : …`, und `disclosed`
 * wird gesetzt, sobald ein ANBIETER ein Gehaltsfeld liefert. Damit
 * bekam jede Portalangabe das Etikett „vom Arbeitgeber angegeben" —
 * die stärkste Aussage, die dieses Produkt über eine Zahl machen kann,
 * vergeben an eine Zahl aus zweiter Hand.
 *
 * Betroffen waren 27 von 190 Gehältern.
 */
export type Gehaltsherkunft =
  /** Der Arbeitgeber hat sie hier selbst eingetragen. */
  | "arbeitgeber"
  /** Sie steht im Text der Anzeige — also vom Arbeitgeber geschrieben. */
  | "anzeige"
  /** Ein Portal liefert sie in einem Feld. Wer sie gemeldet hat, wissen wir nicht. */
  | "portal"
  /** Ein Portal hat sie geschätzt. Niemand hat sie zugesagt. */
  | "schaetzung"
  | "unbekannt";

export interface Gehaltsanzeige {
  /** Der formatierte Betrag, etwa „60.000 € – 80.000 €". */
  betrag: string;
  /** Immer „pro Jahr" — jede Angabe wird auf ein Jahr umgerechnet. */
  zeitraum: string;
  /**
   * Ob dafür gerechnet wurde.
   *
   * Bei einer Jahresangabe `false`. Sonst `true` — und dann gehört
   * ein Hinweis daneben, sonst hält man die Zahl für die Angabe des
   * Arbeitgebers.
   */
  umgerechnet: boolean;
  /** Was in der Anzeige stand, etwa „pro Monat". */
  urspruenglich: string;
  /**
   * Ob der Betrag aus einer anderen Währung stammt — und aus welcher.
   *
   * ══════════════════════════════════════════════════════════════
   * Warum das dasteht und nicht nur die Zahl
   * ══════════════════════════════════════════════════════════════
   *
   * Eine Stelle in Zürich schreibt 95.000 CHF aus. Wer in Deutschland
   * sucht, sieht 101.010 € — und das ist richtig so: Ohne Umrechnung
   * steht die Zahl neben deutschen Gehältern und lässt sich nicht
   * einordnen.
   *
   * Aber sie ist nicht die Zahl aus der Anzeige. Beim Arbeitgeber
   * steht CHF, im Vertrag stünde CHF, und der Kurs von heute ist
   * nicht der von übermorgen. Wer sich auf 101.010 € beruft, beruft
   * sich auf unsere Rechnung.
   *
   * Deshalb steht die Herkunft daneben — dieselbe Regel wie bei
   * `umgerechnet` für den Zeitraum: Eine gerechnete Zahl, die sich
   * nicht als gerechnet zu erkennen gibt, ist die Sorte still
   * erfundene Angabe, gegen die dieses Produkt gebaut ist.
   *
   * `null`, wenn nicht umgerechnet wurde — weil die Währung schon
   * stimmte oder weil es keinen Kurs gibt.
   */
  waehrungUmgerechnet: { von: string; originalBetrag: string; stand: string | null } | null;
  herkunft: Gehaltsherkunft;
  /** Die Herkunft in einem Satzteil, für die Überschrift. */
  herkunftText: string;
  /** Dasselbe in zwei Wörtern — für die Trefferliste. */
  herkunftKurz: string;
  /**
   * Ob die Zahl eine Zusage ist oder eine Vermutung.
   *
   * Der Unterschied, auf den es ankommt: Nach „angegeben" kann man sich
   * richten, nach „geschätzt" nicht.
   */
  zugesagt: boolean;
  /**
   * Darf die Zahl hervorgehoben werden?
   *
   * Nur wo der Arbeitgeber selbst spricht. Eine Portalschätzung in
   * kräftiger Farbe liest sich als bestätigt.
   */
  hervorheben: boolean;
}

const HERKUNFT: Record<Gehaltsherkunft, { lang: string; kurz: string; zugesagt: boolean }> = {
  arbeitgeber: {
    lang: "vom Arbeitgeber angegeben",
    kurz: "vom Arbeitgeber",
    zugesagt: true,
  },
  anzeige: {
    /*
     * Aus dem Text gelesen — aber den Text hat der Arbeitgeber
     * geschrieben. Das ist etwas anderes als eine Portalschätzung und
     * soll auch anders klingen.
     */
    lang: "in der Anzeige genannt",
    kurz: "aus der Anzeige",
    zugesagt: true,
  },
  portal: {
    lang: "vom Stellenportal übernommen",
    kurz: "laut Portal",
    zugesagt: false,
  },
  schaetzung: {
    lang: "vom Stellenportal geschätzt — keine Zusage",
    kurz: "geschätzt",
    zugesagt: false,
  },
  unbekannt: { lang: "Herkunft unklar", kurz: "Herkunft unklar", zugesagt: false },
};

const ZEITRAUM: Record<string, string> = {
  year: "pro Jahr",
  month: "pro Monat",
  hour: "pro Stunde",
  day: "pro Tag",
  week: "pro Woche",
};

/**
 * Alles auf ein Jahr.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum umgerechnet wird
 * ══════════════════════════════════════════════════════════════
 *
 * In einer Liste standen bisher nebeneinander „68.000 pro Jahr",
 * „4.200 pro Monat" und „24 pro Stunde". Drei Zahlen, drei
 * Massstäbe — und der Vergleich, um den es auf dieser Seite geht,
 * fand im Kopf des Lesers statt. Meistens falsch: 4.200 im Monat
 * sind mehr als 48.000, nicht weniger als 68.000.
 *
 * ══════════════════════════════════════════════════════════════
 * Was dabei Annahme ist und was nicht
 * ══════════════════════════════════════════════════════════════
 *
 *   Monat  × 12   — exakt.
 *   Woche  × 52   — exakt.
 *   Tag    × 220  — Annahme: übliche Arbeitstage im Jahr nach Abzug
 *                  von Wochenenden, Feiertagen und Urlaub.
 *   Stunde × 1760 — Annahme: 40 Stunden je Woche auf 44 Arbeitswochen.
 *
 * Die beiden unteren sind Annahmen, und deshalb trägt das Ergebnis
 * `umgerechnet: true`. Die Oberfläche schreibt „umgerechnet" daneben,
 * damit niemand die Zahl für die Angabe des Arbeitgebers hält.
 *
 * Ohne diese Kennzeichnung wäre die Umrechnung genau die Sorte
 * stillschweigend erfundene Zahl, gegen die dieses Produkt gebaut
 * ist — nur eine, die man für eine Auskunft hält.
 */
/**
 * Der Faktor auf ein Jahr.
 *
 * ── Warum 1760 Stunden und 220 Tage ───────────────────────────
 *
 * 220 Arbeitstage sind 260 Wochentage abzüglich Urlaub und
 * Feiertagen — der übliche Ansatz. Mal acht Stunden ergibt 1760.
 *
 * Beides sind Annahmen, und sie stehen deshalb an einer Stelle: Wer
 * sie ändert, ändert sie überall. Zwei Tabellen mit verschiedenen
 * Zahlen hiessen, dass dieselbe Stelle je nach Baustein ein anderes
 * Jahresgehalt hat.
 */
export const AUF_JAHR: Record<string, number> = {
  year: 1,
  month: 12,
  week: 52,
  day: 220,
  hour: 1760,
};

/**
 * Die Anzeige für ein Gehalt. `null`, wenn es keinen Betrag gibt.
 *
 * `null` heisst „nichts anzuzeigen", nicht „kein Gehalt". Die
 * aufrufende Stelle schreibt dann „Gehalt nicht angegeben" — was die
 * ehrliche Aussage ist: Wir wissen es nicht.
 */
export function gehaltsanzeige(
  salary: Job["salary"],
  /**
   * In welche Währung umgerechnet werden soll — und womit.
   *
   * Ohne diese Angabe bleibt alles, wie es war: Der Betrag steht in
   * der Währung der Anzeige. Das ist der richtige Rückfall — eine
   * Umrechnung ohne Kurs wäre keine.
   */
  umrechnung?: { ziel: string; kurse: Record<string, number>; stand?: string | null },
): Gehaltsanzeige | null {
  if (salary.min === null && salary.max === null) return null;

  const faktor = AUF_JAHR[salary.period] ?? 1;
  let jahresMin = salary.min === null ? null : Math.round(salary.min * faktor);
  let jahresMax = salary.max === null ? null : Math.round(salary.max * faktor);

  /*
   * Erst auf ein Jahr, dann in die Währung.
   *
   * Die Reihenfolge ist gleichgültig fürs Ergebnis und nicht fürs
   * Runden: Erst zu runden und dann zu multiplizieren häuft den
   * Rundungsfehler mit dem Faktor an. Bei einem Stundenlohn ist der
   * Faktor 1760.
   */
  let waehrungUmgerechnet: Gehaltsanzeige["waehrungUmgerechnet"] = null;
  let anzeigeWaehrung = salary.currency;

  if (umrechnung && salary.currency && salary.currency.toUpperCase() !== umrechnung.ziel.toUpperCase()) {
    const min = jahresMin === null ? null : umrechnen(jahresMin, salary.currency, umrechnung.ziel, umrechnung.kurse);
    const max = jahresMax === null ? null : umrechnen(jahresMax, salary.currency, umrechnung.ziel, umrechnung.kurse);

    /*
     * Nur wenn ALLES umgerechnet werden konnte.
     *
     * Eine Spanne, deren Untergrenze in Euro und deren Obergrenze in
     * Franken steht, ist keine Spanne. Fehlt der Kurs — bei ARS und
     * UAH veröffentlicht die EZB keinen —, bleibt der Betrag ganz in
     * seiner Währung.
     */
    const vollstaendig =
      (jahresMin === null || min !== null) && (jahresMax === null || max !== null);

    if (vollstaendig) {
      const original = spanne(jahresMin, jahresMax, salary.currency);
      jahresMin = min === null ? null : Math.round(min);
      jahresMax = max === null ? null : Math.round(max);
      anzeigeWaehrung = umrechnung.ziel;
      if (original) {
        waehrungUmgerechnet = {
          von: salary.currency.toUpperCase(),
          originalBetrag: original,
          stand: umrechnung.stand ?? null,
        };
      }
    }
  }

  const betrag = spanne(jahresMin, jahresMax, anzeigeWaehrung);
  if (!betrag) return null;

  /*
   * Die Herkunft kommt aus `provenance`, nicht aus `disclosed`.
   *
   * `disclosed` sagt nur, ob ein Anbieter ein Feld geliefert hat. Es
   * unterscheidet nicht zwischen „der Arbeitgeber hat es gesagt" und
   * „ein Portal hat es weitergereicht" — und genau dieser Unterschied
   * ist der Grund, warum es diese Datei gibt.
   */
  const herkunft: Gehaltsherkunft =
    salary.provenance === "employer"
      ? "arbeitgeber"
      : salary.provenance === "text"
        ? "anzeige"
        : salary.provenance === "board_estimate"
          ? "schaetzung"
          : salary.provenance === "provider"
            ? "portal"
            : "unbekannt";

  const h = HERKUNFT[herkunft];

  return {
    betrag,
    /* Immer „pro Jahr" — die Zahl ist es jetzt auch. */
    zeitraum: ZEITRAUM.year!,
    umgerechnet: faktor !== 1,
    urspruenglich: ZEITRAUM[salary.period] ?? "",
    waehrungUmgerechnet,
    herkunft,
    herkunftText: h.lang,
    herkunftKurz: h.kurz,
    zugesagt: h.zugesagt,
    hervorheben: herkunft === "arbeitgeber",
  };
}


/**
 * Einen Betrag auf ein Jahr hochrechnen.
 *
 * `null` nur bei fehlendem Betrag — ein unbekannter Zeitraum gilt als
 * Jahr, weil das in deutschen Anzeigen der Normalfall ist und die
 * Alternative wäre, die Angabe wegzuwerfen.
 */
export function aufJahresbetrag(betrag: number | null, zeitraum: string): number | null {
  if (betrag === null) return null;
  return Math.round(betrag * (AUF_JAHR[zeitraum] ?? 1));
}
