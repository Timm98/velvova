/**
 * Wie viel Lebenszeit kostet der Weg zur Arbeit — im Monat?
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nicht „25 statt 45 Minuten" genügt
 * ══════════════════════════════════════════════════════════════
 *
 * Die Zahl je Strecke ist die, die jeder nennt, und sie ist die
 * falsche, sobald sich die Zahl der Tage vor Ort ändert. Zwei Beispiele
 * mit denselben Minuten:
 *
 *     45 min · 2 Tage vor Ort  →  13,0 Stunden im Monat
 *     25 min · 5 Tage vor Ort  →  18,1 Stunden im Monat
 *
 * Der kürzere Weg kostet hier mehr Zeit. Wer nur die Minuten
 * vergleicht, empfiehlt die Stelle, die den Alltag verlängert — und
 * begründet es mit einer richtigen Zahl.
 *
 * Genau dieser Fall ist im Prüfbestand als B04 vorgesehen.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Rechnung, und warum sie so einfach bleibt
 * ══════════════════════════════════════════════════════════════
 *
 *     Minuten je Richtung × 2 × Tage je Woche × 52 / 12 / 60
 *
 * 52 Wochen durch 12 Monate: der typische Monat, nicht das Jahresmittel
 * nach Urlaub und Feiertagen. Das ist eine Annahme, und sie wird
 * mitgeliefert, statt im Ergebnis zu verschwinden.
 *
 * Kein Urlaubsabzug: Wer ihn einrechnen will, braucht Urlaubstage,
 * Feiertage nach Bundesland und die Frage, ob Krankheitstage zählen.
 * Drei geratene Zahlen machen eine gerechnete Zahl nicht genauer.
 *
 * Keine Fahrtkosten: Dafür fehlen Kilometer, Verkehrsmittel und
 * Kostenbasis. Eine Ersparnis in Euro zu behaupten, ohne sie zu haben,
 * wäre dieselbe Art Fehler wie eine Pendelzeit zu einem ungeklärten Ort.
 */

/** 52 Wochen auf 12 Monate. Steht hier, damit die Annahme einen Namen hat. */
export const WOCHEN_JE_MONAT = 52 / 12;

export interface Wegangabe {
  /** Reine Fahrzeit für eine Richtung, in Minuten. */
  minutenJeRichtung: number;
  /** Tage je Woche, an denen dieser Weg tatsächlich anfällt. */
  vorOrtTageJeWoche: number;
}

/**
 * Stunden je typischem Monat.
 *
 * Ungerundet: Gerundet wird erst bei der Ausgabe. Wer früh rundet,
 * addiert Rundungsfehler und erklärt sie später als Unterschied.
 */
export function stundenJeMonat(w: Wegangabe): number {
  return (w.minutenJeRichtung * 2 * w.vorOrtTageJeWoche * WOCHEN_JE_MONAT) / 60;
}

export interface Wegvergleich {
  vorherStunden: number;
  nachherStunden: number;
  /** Positiv heisst: weniger Zeit unterwegs. */
  ersparnisStunden: number;
  richtung: "weniger" | "mehr" | "gleich";
  /**
   * Die Minuten je Strecke gehen in die andere Richtung als die
   * Monatszeit.
   *
   * Der Fall, für den diese Datei gebaut ist. Wer ihn nicht kennzeichnet,
   * zeigt „kürzerer Weg" über einer Zahl, die das Gegenteil sagt.
   */
  gegenlaeufig: boolean;
  satz: string;
  /** Was angenommen wurde. Steht immer dabei. */
  annahme: string;
}

/** Eine Stundenzahl, wie man sie sagt: „14,4 Stunden". */
export function stundenText(stunden: number): string {
  const gerundet = Math.round(stunden * 10) / 10;
  return `${gerundet.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Stunden`;
}

/**
 * Heute gegen die neue Stelle — auf Monatsbasis.
 *
 * Beide Seiten brauchen Tage vor Ort. Fehlen sie, gibt es kein
 * Ergebnis: Fünf Bürotage anzunehmen, weil es die häufigste Zahl ist,
 * wäre eine erfundene Grundlage für eine Aussage über den Alltag.
 */
export function wegvergleich(heute: Wegangabe, neu: Wegangabe): Wegvergleich {
  const vorherStunden = stundenJeMonat(heute);
  const nachherStunden = stundenJeMonat(neu);
  const ersparnisStunden = vorherStunden - nachherStunden;

  /* Eine Zehntelstunde ist die Auflösung, in der ausgegeben wird.
     Darunter von „mehr" oder „weniger" zu sprechen, behauptet einen
     Unterschied, den niemand merkt. */
  const richtung: Wegvergleich["richtung"] =
    Math.abs(ersparnisStunden) < 0.05 ? "gleich" : ersparnisStunden > 0 ? "weniger" : "mehr";

  const minutenKuerzer = neu.minutenJeRichtung < heute.minutenJeRichtung;
  const gegenlaeufig = minutenKuerzer && richtung === "mehr";

  const satz =
    richtung === "gleich"
      ? "Am Weg ändert sich im Monat praktisch nichts."
      : gegenlaeufig
        ? `Die einzelne Fahrt ist kürzer (${neu.minutenJeRichtung} statt ${heute.minutenJeRichtung} Minuten), ` +
          `im Monat bist du wegen der ${neu.vorOrtTageJeWoche} Tage vor Ort aber ` +
          `${stundenText(Math.abs(ersparnisStunden))} länger unterwegs.`
        : richtung === "weniger"
          ? `${stundenText(ersparnisStunden)} weniger unterwegs pro typischem Arbeitsmonat.`
          : `${stundenText(Math.abs(ersparnisStunden))} mehr unterwegs pro typischem Arbeitsmonat.`;

  return {
    vorherStunden,
    nachherStunden,
    ersparnisStunden,
    richtung,
    gegenlaeufig,
    satz,
    annahme:
      `Angenommen: ${heute.vorOrtTageJeWoche} Tage vor Ort heute, ${neu.vorOrtTageJeWoche} in der neuen Stelle, ` +
      "ohne Urlaub und Feiertage.",
  };
}
