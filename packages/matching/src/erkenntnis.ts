/**
 * Was Nina weiss, was sie vermutet, und wie man das auseinanderhält.
 *
 * ══════════════════════════════════════════════════════════════
 * Der Befund, der dieses Modul ausgelöst hat
 * ══════════════════════════════════════════════════════════════
 *
 * Gemessen am 6. September 2026 an 486 Belegen von 96 Menschen:
 *
 *   ai_hypothesis · constraint          44 Belege   Konfidenz 0.90
 *   ai_hypothesis · experience_episode  53 Belege   Konfidenz 0.90
 *   user_stated   · motive              78 Belege   Konfidenz 0.82
 *
 * Ninas Vermutungen trugen eine höhere Konfidenz als das, was die
 * Menschen selbst gesagt haben.
 *
 * Das ist keine Ungenauigkeit, sondern eine Umkehrung: Wenn eine
 * Ableitung schwerer wiegt als eine Aussage, dann überstimmt das
 * System die Person in ihrer eigenen Sache — und niemand sieht es,
 * weil beide Zahlen gleich aussehen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Art nicht als eigene Spalte gespeichert wird
 * ══════════════════════════════════════════════════════════════
 *
 * Sie steht schon da. `source_type` sagt, woher eine Angabe kommt,
 * und daraus folgt zwingend, was sie ist: Was jemand gesagt hat, ist
 * eine Aussage. Was ein Modell abgeleitet hat, ist eine Vermutung.
 *
 * Eine zweite Spalte könnte der ersten widersprechen — und dann gäbe
 * es zwei Wahrheiten über denselben Satz.
 */

/** Woher eine Angabe stammt. Entspricht `source_type` in der Datenbank. */
export type Belegquelle =
  | "user_stated"
  | "user_confirmed"
  | "document_extract"
  | "ai_hypothesis"
  | "external_source"
  | "work_sample";

/**
 * Was eine Angabe ist — abgeleitet, nicht gespeichert.
 *
 *   fact         belegt: Zeugnis, Lebenslauf, Arbeitsprobe
 *   preference   gesagt: was die Person will
 *   observation  beobachtet: was sie getan hat
 *   inference    vermutet: was ein Modell daraus schliesst
 */
export type Erkenntnisart = "fact" | "preference" | "observation" | "inference";

export interface Beleg {
  quelle: Belegquelle;
  /** Was gespeichert wurde. Kann über dem Deckel liegen — siehe unten. */
  konfidenz: number;
  /** Ob die Person sie ausdrücklich bestätigt hat. */
  bestaetigt?: boolean;
  /** Ob sie ausdrücklich widersprochen hat. */
  abgelehnt?: boolean;
}

/**
 * Die Obergrenze je Quelle.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum Deckel und keine festen Werte
 * ══════════════════════════════════════════════════════════════
 *
 * Ein fester Wert würde Unterschiede innerhalb einer Quelle
 * einebnen: Eine Vermutung aus fünfzehn übereinstimmenden Signalen
 * ist stärker als eine aus zweien, und beide sind Vermutungen.
 *
 * Der Deckel lässt diese Abstufung zu und verhindert nur das eine:
 * dass eine Vermutung so sicher dasteht wie eine Aussage.
 *
 * Die Zahlen folgen den Bändern aus dem Auftrag:
 *   0.95–1.00  explizit, sehr sicher
 *   0.75–0.94  starke Evidenz
 *   0.50–0.74  plausible Inferenz
 *   unter 0.50 schwaches Signal
 */
export const KONFIDENZ_DECKEL: Record<Belegquelle, number> = {
  /* Bestätigt: das Höchste, was es gibt. */
  user_confirmed: 1.0,
  /* Gesagt: sehr sicher, aber Menschen ändern ihre Meinung. */
  user_stated: 0.95,
  /* Zeugnis, Lebenslauf: belegt, aber Dokumente sind auch nur Papier. */
  document_extract: 0.9,
  /* Arbeitsprobe: gezeigt, nicht behauptet. */
  work_sample: 0.9,
  /* Fremde Quelle: wir haben sie nicht geprüft. */
  external_source: 0.7,
  /*
   * Modellvermutung: bleibt im Band der plausiblen Inferenz.
   *
   * 0.74 ist die Obergrenze dieses Bandes. Eine Vermutung darf nie
   * in das Band der starken Evidenz aufsteigen — dort stehen Dinge,
   * die jemand gesagt oder ein Dokument belegt hat.
   */
  ai_hypothesis: 0.74,
};

export function erkenntnisart(beleg: Beleg): Erkenntnisart {
  if (beleg.bestaetigt) return "fact";
  switch (beleg.quelle) {
    case "user_confirmed":
      return "fact";
    case "document_extract":
    case "work_sample":
      return "fact";
    case "user_stated":
      return "preference";
    case "external_source":
      return "observation";
    case "ai_hypothesis":
      return "inference";
  }
}

/**
 * Die Konfidenz, mit der gerechnet werden darf.
 *
 * ── Warum der gespeicherte Wert stehen bleibt ─────────────────
 *
 * Weil er dokumentiert, was das Modell damals meinte. Ihn zu
 * überschreiben hiesse, die Geschichte zu ändern; ihn ungedeckelt
 * zu benutzen hiesse, ihr zu glauben. Der Deckel greift beim Lesen.
 */
export function wirksameKonfidenz(beleg: Beleg): number {
  if (beleg.abgelehnt) return 0;
  if (beleg.bestaetigt) return 1;
  return Math.min(beleg.konfidenz, KONFIDENZ_DECKEL[beleg.quelle]);
}

/**
 * Die Rangfolge der Quellen.
 *
 * Höher heisst: gewinnt im Widerspruchsfall. Aus dem Auftrag,
 * Abschnitt C.
 */
const RANG: Record<Belegquelle, number> = {
  user_confirmed: 6,
  user_stated: 5,
  document_extract: 4,
  work_sample: 4,
  external_source: 2,
  ai_hypothesis: 1,
};

export type Vergleichsausgang = "a" | "b" | "gleichrangig";

/**
 * Welcher von zwei widersprechenden Belegen gilt.
 *
 * ══════════════════════════════════════════════════════════════
 * Das Beispiel aus dem Auftrag
 * ══════════════════════════════════════════════════════════════
 *
 *   Nina hat abgeleitet: „möchte wahrscheinlich remote"  (0.62)
 *   Später sagt die Person: „ich will jeden Tag ins Büro"
 *
 * Die Aussage gewinnt — nicht weil sie neuer ist, sondern weil sie
 * von der Person kommt. Eine Ableitung über sie kann nicht besser
 * wissen, was sie will.
 *
 * ── Warum nicht einfach die höhere Konfidenz ─────────────────
 *
 * Weil genau das der Fehler in den Daten war: Vermutungen mit 0.90
 * standen über Aussagen mit 0.82. Die Konfidenz entscheidet erst
 * innerhalb derselben Rangstufe.
 */
export function staerkerer(a: Beleg, b: Beleg): Vergleichsausgang {
  const ra = RANG[a.quelle];
  const rb = RANG[b.quelle];
  if (ra !== rb) return ra > rb ? "a" : "b";

  const ka = wirksameKonfidenz(a);
  const kb = wirksameKonfidenz(b);
  /*
   * Innerhalb einer Rangstufe entscheidet die Konfidenz — aber nur
   * bei deutlichem Abstand. Zwei Aussagen derselben Person, die sich
   * um drei Hundertstel unterscheiden, sind gleich stark; welche
   * gilt, ist dann eine Frage an sie und nicht an eine Zahl.
   */
  if (Math.abs(ka - kb) < 0.1) return "gleichrangig";
  return ka > kb ? "a" : "b";
}

/**
 * Ob eine Angabe stark genug ist, um eine Entscheidung zu tragen.
 *
 * ── Warum das eine eigene Frage ist ───────────────────────────
 *
 * „Schwache Signale dürfen niemals starke Karriereentscheidungen
 * treiben." Eine Vermutung mit 0.55 darf in einer Zusammenfassung
 * stehen — sie darf nicht der Grund sein, warum jemandem ein
 * Berufsweg empfohlen oder verschwiegen wird.
 */
export const ENTSCHEIDUNGSSCHWELLE = 0.75;

export function traegtEntscheidung(beleg: Beleg): boolean {
  return wirksameKonfidenz(beleg) >= ENTSCHEIDUNGSSCHWELLE;
}

/** Das Band, in dem eine Konfidenz liegt — für Anzeige und Protokoll. */
export function konfidenzband(k: number): "sicher" | "stark" | "plausibel" | "schwach" {
  if (k >= 0.95) return "sicher";
  if (k >= 0.75) return "stark";
  if (k >= 0.5) return "plausibel";
  return "schwach";
}
