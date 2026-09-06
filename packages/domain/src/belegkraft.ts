/**
 * Wie stark ein Beleg trägt — und warum das der Kern ist.
 *
 * ── Der Markt für Zitronen ────────────────────────────────────
 *
 * Ein Lebenslauf ist eine unprüfbare Behauptung. Alle wissen es, alle
 * runden auf, alle rechnen den Aufschlag wieder heraus. Bestraft wird
 * dabei ausgerechnet, wer ehrlich ist: Er kann seine Ehrlichkeit nicht
 * glaubhaft machen.
 *
 * Eine Behauptung wird glaubwürdig, wenn sie zwei Eigenschaften hat:
 * Sie kostet etwas, und sie ist überprüfbar. Genau das unterscheidet
 * die Stufen hier.
 *
 * ── Warum wir das auf uns selbst anwenden müssen ──────────────
 *
 * Wir halten Arbeitgeber an ihren Zusagen fest — mit Herkunft, Frist
 * und Nachprüfung. Auf der Bewerberseite steht bis heute jeder Beleg
 * als `user_stated` oder `ai_hypothesis` da. Dieselbe Asymmetrie, die
 * wir dem Markt vorwerfen, nur mit umgekehrtem Vorzeichen.
 */

export const BELEGSTUFEN = ["beobachtet", "berichtet", "bestaetigt", "behauptet"] as const;
export type Belegstufe = (typeof BELEGSTUFEN)[number];

export const BELEGSTUFENTEXT: Record<Belegstufe, { wort: string; erklaerung: string }> = {
  beobachtet: {
    wort: "beobachtet",
    erklaerung: "In einer Arbeitsprobe gezeigt — nicht behauptet, sondern getan.",
  },
  berichtet: {
    wort: "über Zeit berichtet",
    erklaerung: "Mehrfach über Monate hinweg dasselbe gesagt, in verschiedenen Stellen.",
  },
  bestaetigt: {
    wort: "von anderen bestätigt",
    erklaerung: "Jemand, der die Arbeit kennt, hat es bestätigt.",
  },
  behauptet: {
    wort: "selbst gesagt",
    erklaerung: "Im Gespräch genannt. Nicht falsch — nur unbelegt.",
  },
};

/**
 * Wie schwer eine Stufe wiegt.
 *
 * Der Abstand zwischen `beobachtet` und `behauptet` ist bewusst gross:
 * Eine Arbeitsprobe kann schiefgehen, und genau deshalb bedeutet ein
 * Beleg daraus etwas. Eine Selbstauskunft kann nicht schiefgehen —
 * und bedeutet deshalb wenig.
 */
export const BELEGGEWICHT: Record<Belegstufe, number> = {
  beobachtet: 1.0,
  bestaetigt: 0.8,
  berichtet: 0.7,
  behauptet: 0.3,
};

/**
 * Die Stufe zu einer Herkunft aus `evidence_items.source_type`.
 *
 * `ai_hypothesis` ist ausdrücklich `behauptet` und nicht schwächer:
 * Eine aus dem Gespräch abgeleitete Aussage ist eine Behauptung über
 * den Menschen — sie wird nicht dadurch besser, dass eine Maschine sie
 * formuliert hat, und nicht dadurch schlechter.
 */
export function belegstufe(
  sourceType: string,
  userConfirmed: boolean,
  sourceRef?: string | null,
): Belegstufe {
  /*
   * Der Verlauf sticht die Herkunft.
   *
   * Eine über Monate wiederholte Aussage steht als `user_stated` in der
   * Tabelle — die Herkunft ist ja tatsächlich der Mensch selbst. Was
   * sie trägt, ist nicht die Quelle, sondern die Zeit; deshalb steht
   * das hier vor allen anderen Regeln.
   */
  if (sourceRef?.startsWith("verlauf:")) return "berichtet";
  if (sourceType === "work_sample") return "beobachtet";
  if (sourceType === "external_source") return "bestaetigt";
  if (sourceType === "document_extract") return userConfirmed ? "bestaetigt" : "behauptet";
  return "behauptet";
}

export interface Belegbilanz {
  gesamt: number;
  beobachtet: number;
  berichtet: number;
  bestaetigt: number;
  behauptet: number;
  /**
   * Wie viel des Profils belegt ist. 0 bis 1.
   *
   * Ausdrücklich keine Note. Ein Profil aus lauter Selbstauskünften ist
   * nicht schlechter als eines mit Arbeitsproben — es ist ungeprüft,
   * und das ist etwas anderes. Die Zahl sagt, wie viel jemand zeigen
   * kann, nicht wie gut er ist.
   */
  belegt: number;
}

export function belegbilanz(stufen: readonly Belegstufe[]): Belegbilanz {
  const z = (s: Belegstufe) => stufen.filter((x) => x === s).length;
  const gesamt = stufen.length;
  if (gesamt === 0) {
    return { gesamt: 0, beobachtet: 0, berichtet: 0, bestaetigt: 0, behauptet: 0, belegt: 0 };
  }
  const summe = stufen.reduce((a, s) => a + BELEGGEWICHT[s], 0);
  return {
    gesamt,
    beobachtet: z("beobachtet"),
    berichtet: z("berichtet"),
    bestaetigt: z("bestaetigt"),
    behauptet: z("behauptet"),
    belegt: summe / gesamt,
  };
}
