/**
 * Ob eine Erkenntnis es wert ist, jemanden zu unterbrechen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum diese Schicht überhaupt nötig wurde
 * ══════════════════════════════════════════════════════════════
 *
 * Seit die Intelligenzschicht Widersprüche, Wissenslücken und
 * Unsicherheiten erkennt, hat Nina jederzeit etwas zu sagen. Bei
 * einem durchschnittlichen Profil stehen ein bis zwei Widersprüche,
 * eine offene Frage und mehrere schwache Vermutungen gleichzeitig.
 *
 * Alles davon anzuzeigen wäre kein Assistent, sondern ein Postfach.
 * Die Zurückhaltung in `engine.ts` regelt, WIE OFT Nina spricht.
 * Diese Datei regelt, WORÜBER — und das ist die schwierigere Frage:
 * Wenn nur eine Meldung durchkommt, muss es die richtige sein.
 *
 * ══════════════════════════════════════════════════════════════
 * Drei Ausschlüsse und vier Gewichte
 * ══════════════════════════════════════════════════════════════
 *
 * Die Ausschlüsse sind hart, weil sie nicht abwägbar sind:
 *
 *   schon gezeigt      Dasselbe zweimal zu sagen ist nie richtig.
 *   nicht handelbar    Eine Erkenntnis, aus der nichts folgt, ist
 *                      eine Mitteilung über den Zustand des Systems.
 *   passt nicht        Wer gerade eine Bewerbung schreibt, will nicht
 *                      über seine Gehaltsvorstellung diskutieren.
 *
 * Der letzte ist ein Aufschub, kein Verwerfen: Die Gelegenheit bleibt
 * stehen und wird beim nächsten Mal neu bewertet.
 */

export interface Relevanzlage {
  /** Was auf dem Spiel steht, 0 bis 1. Eine Ordnung, keine Wahrscheinlichkeit. */
  wirkung: number;
  /** Wie sicher die Erkenntnis ist, 0 bis 1. */
  konfidenz: number;
  /** Wie neu sie ist — 1 beim ersten Mal, fallend mit jeder Wiederholung. */
  neuheit: number;
  /** Ob es eilt, 0 bis 1. Eine ablaufende Anzeige eilt, eine Wissenslücke nicht. */
  dringlichkeit: number;
  /** Ob die Person daraufhin etwas tun kann. */
  handelbar: boolean;
  /** Ob es zu dem passt, was sie gerade macht. */
  passtZumKontext: boolean;
  /** Ob genau das schon einmal gesagt wurde. */
  schonGezeigt: boolean;
}

/**
 * Die Gewichte.
 *
 * ── Warum Wirkung vor Konfidenz steht ─────────────────────────
 *
 * Weil ein sehr sicherer Hinweis auf etwas Belangloses schlechter
 * ist als ein plausibler Hinweis auf etwas Wichtiges. „Deine
 * Wunschstelle liegt 4.000 Euro unter deiner Untergrenze" ist auch
 * dann die richtige Meldung, wenn die Zahl noch geprüft werden muss.
 *
 * Die vier Zahlen sind eine Produktentscheidung, kein Messwert. Sie
 * sind nicht gegen Nutzerurteile validiert und gehören kalibriert,
 * sobald es Ablehnungsdaten in nennenswerter Zahl gibt.
 */
export const GEWICHTE = {
  wirkung: 0.35,
  konfidenz: 0.25,
  dringlichkeit: 0.2,
  neuheit: 0.2,
} as const;

/**
 * Ab wann eine Erkenntnis unterbrechen darf.
 *
 * 0,55 trennt die Beispiele aus dem Auftrag sauber: Der verletzte
 * Gehaltsboden bei einer Wunschstelle liegt bei 0,91, ein starker
 * Widerspruch bei 0,68 — ein einzelner weggeklickter Job bei 0,33
 * und eine schwache Vermutung bei 0,43.
 */
export const RELEVANZ_SCHWELLE = 0.55;

function klemmen(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Der Relevanzwert, 0 bis 1.
 *
 * `0` heisst: nicht zeigen. Das ist der häufigste richtige Wert.
 */
export function relevanz(lage: Relevanzlage): number {
  if (lage.schonGezeigt) return 0;
  if (!lage.handelbar) return 0;
  if (!lage.passtZumKontext) return 0;

  return (
    GEWICHTE.wirkung * klemmen(lage.wirkung) +
    GEWICHTE.konfidenz * klemmen(lage.konfidenz) +
    GEWICHTE.dringlichkeit * klemmen(lage.dringlichkeit) +
    GEWICHTE.neuheit * klemmen(lage.neuheit)
  );
}

export function darfUnterbrechen(lage: Relevanzlage): boolean {
  return relevanz(lage) >= RELEVANZ_SCHWELLE;
}

/**
 * Wie neu eine Erkenntnis noch ist, nach `male` Anzeigen.
 *
 * ── Warum nicht einfach „schon gezeigt = nie wieder" ──────────
 *
 * Weil manche Hinweise zu Recht wiederkehren: Eine Wissenslücke, die
 * beim ersten Mal übergangen wurde, ist beim dritten Gespräch
 * darüber wieder erwähnenswert. Sie darf nur nicht mehr dieselbe
 * Dringlichkeit haben wie beim ersten Mal.
 *
 * Halbierung je Anzeige: Nach dem dritten Mal liegt die Neuheit bei
 * 0,25 und trägt damit fast nichts mehr bei — was faktisch bedeutet,
 * dass nur noch sehr gewichtige Hinweise ein viertes Mal durchkommen.
 */
export const ANLAEUFE_MAX = 2;

/**
 * Ob dieselbe Erkenntnis noch einmal versucht werden darf.
 *
 * ── Warum eine harte Grenze neben der Neuheit ─────────────────
 *
 * Weil die Neuheit ein Gewicht ist und kein Verbot: Ein sehr
 * gewichtiger Hinweis kommt auch mit 0,25 Neuheit noch über die
 * Schwelle, und dann fragt Nina ein drittes und viertes Mal
 * dasselbe.
 *
 * Einmal fragen, einmal nachfassen, dann still sein. Wer nach dem
 * zweiten Mal nicht geantwortet hat, hat geantwortet.
 */
export function nochEinAnlauf(male: number): boolean {
  return male < ANLAEUFE_MAX;
}

export function neuheitNach(male: number): number {
  if (male <= 0) return 1;
  return 1 / 2 ** male;
}
