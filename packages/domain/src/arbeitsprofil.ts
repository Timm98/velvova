import { z } from "zod";

/**
 * Der Career Twin: benannte Dimensionen statt Freitext.
 *
 * ── Was vorher da war ─────────────────────────────────────────
 *
 * `workStylePreferences` — eine Liste von Sätzen wie „ich arbeite gern
 * eigenständig". Der Fit verglich sie per Wortüberschneidung mit der
 * Stellenbeschreibung. Das misst, ob dieselben Wörter vorkommen, nicht
 * ob die Arbeit zur Person passt: „eigenständig" steht in fast jeder
 * Anzeige, und eine Anzeige, die es nicht schreibt, kann trotzdem die
 * freieste Stelle sein.
 *
 * ── Warum genau diese zehn ────────────────────────────────────
 *
 * Sie sind die Achsen, an denen Menschen scheitern, obwohl sie die
 * Arbeit können. Niemand kündigt, weil er die Aufgabe nicht beherrscht
 * — sondern weil das Tempo zermürbt, die Verantwortung erdrückt oder
 * der ständige Kundenkontakt leert.
 *
 * ── Warum jede Angabe eine Herkunft trägt ─────────────────────
 *
 * „Ich arbeite gern unter Druck" aus einem Gespräch ist etwas anderes
 * als dieselbe Aussage nach drei Check-ins in einem hektischen Job. Die
 * Herkunft entscheidet, wie schwer die Angabe wiegt — und ohne sie
 * würde eine Selbsteinschätzung so behandelt wie eine beobachtete
 * Tatsache.
 */

export const ARBEITSDIMENSIONEN = [
  "autonomie",
  "teamarbeit",
  "kundenkontakt",
  "belastung",
  "struktur",
  "tempo",
  "sicherheit",
  "lernen",
  "verantwortung",
  "wiederholung",
] as const;

export const ArbeitsdimensionSchema = z.enum(ARBEITSDIMENSIONEN);
export type Arbeitsdimension = z.infer<typeof ArbeitsdimensionSchema>;

/** Was die Dimension bedeutet — in der Sprache, in der gefragt wird. */
export const DIMENSIONSTEXT: Record<Arbeitsdimension, { frage: string; wenig: string; viel: string }> = {
  autonomie: {
    frage: "Wie viel willst du selbst entscheiden?",
    wenig: "klare Ansagen",
    viel: "eigene Entscheidungen",
  },
  teamarbeit: {
    frage: "Allein oder im Team?",
    wenig: "für mich allein",
    viel: "eng im Team",
  },
  kundenkontakt: {
    frage: "Wie viel Kontakt mit Kunden?",
    wenig: "kaum Kundenkontakt",
    viel: "den ganzen Tag Menschen",
  },
  belastung: {
    frage: "Wie viel Druck verträgst du?",
    wenig: "ruhig und planbar",
    viel: "Druck spornt mich an",
  },
  struktur: {
    frage: "Feste Abläufe oder offene Aufgaben?",
    wenig: "offen, ich ordne selbst",
    viel: "klare Abläufe",
  },
  tempo: {
    frage: "Wie schnell soll es zugehen?",
    wenig: "gründlich statt schnell",
    viel: "schnelles Tempo",
  },
  sicherheit: {
    frage: "Wie wichtig ist Sicherheit?",
    wenig: "Risiko ist in Ordnung",
    viel: "sicher und unbefristet",
  },
  lernen: {
    frage: "Wie viel Neues willst du lernen?",
    wenig: "das Gelernte anwenden",
    viel: "ständig dazulernen",
  },
  verantwortung: {
    frage: "Wie viel Verantwortung willst du tragen?",
    wenig: "meine Aufgabe, mehr nicht",
    viel: "Verantwortung für andere",
  },
  wiederholung: {
    frage: "Gleiches oder immer Neues?",
    wenig: "jeden Tag etwas anderes",
    viel: "eingespielte Abläufe",
  },
};

/**
 * Woher eine Angabe stammt — und damit, wie schwer sie wiegt.
 *
 * `beobachtet` ist die einzige Herkunft, die nicht auf einer
 * Selbstauskunft beruht. Sie entsteht aus Check-ins: Wer nach
 * neunzig Tagen in einer Stelle mit hohem Tempo unzufrieden ist, sagt
 * damit etwas über sich, das kein Gespräch hergibt.
 */
export const AngabenherkunftSchema = z.enum(["gespraech", "selbstauskunft", "probe", "beobachtet"]);
export type Angabenherkunft = z.infer<typeof AngabenherkunftSchema>;

/** Wie schwer eine Herkunft wiegt. Beobachtetes schlägt Behauptetes. */
export const ANGABENGEWICHT: Record<Angabenherkunft, number> = {
  beobachtet: 1.0,
  probe: 0.8,
  gespraech: 0.6,
  selbstauskunft: 0.5,
};

export const ArbeitsprofilwertSchema = z.object({
  dimension: ArbeitsdimensionSchema,
  /** 0 bis 1. 0 ist das eine Ende der Achse, 1 das andere. */
  wert: z.number().min(0).max(1),
  herkunft: AngabenherkunftSchema,
  /** Der Satz, der den Wert belegt. Ohne ihn ist die Zahl nicht prüfbar. */
  beleg: z.string().default(""),
  /**
   * Ob der Mensch die abgeleitete Aussage bestätigt hat.
   *
   * `null` heisst „noch nicht gefragt". Siehe `zusammenfassen()` für
   * die Folgen: unbestätigt zählt halb, abgelehnt gar nicht.
   */
  bestaetigt: z.boolean().nullable().default(null),
  erfasstAm: z.date(),
});
export type Arbeitsprofilwert = z.infer<typeof ArbeitsprofilwertSchema>;

/**
 * Der zusammengefasste Wert je Dimension.
 *
 * Mehrere Angaben zur selben Dimension werden nach Herkunft gewichtet
 * gemittelt — nicht die neueste gewinnt. Eine Beobachtung von gestern
 * ist mehr wert als eine Selbstauskunft von heute, und die Reihenfolge
 * allein sagt nichts über die Güte.
 */
export function zusammenfassen(werte: Arbeitsprofilwert[]): { wert: number; gewicht: number } | null {
  if (werte.length === 0) return null;
  let summe = 0;
  let gewichte = 0;
  for (const w of werte) {
    /*
     * Abgelehnt heisst weg.
     *
     * Wer sagt „nein, so habe ich das nicht gemeint", hat die Aussage
     * zurückgenommen. Sie mit halbem Gewicht weiterzuführen wäre die
     * Behauptung, er habe sie doch irgendwie gemeint.
     */
    if (w.bestaetigt === false) continue;

    /*
     * Noch nicht bestätigt zählt halb.
     *
     * Eine aus einem Nebensatz gelesene Aussage ist ein Vorschlag, kein
     * Befund. Sie soll wirken — sonst bliebe das Profil leer, bis
     * jemand zehn Regler bewegt — aber nicht so stark wie eine, der
     * jemand ausdrücklich zugestimmt hat.
     */
    const g = ANGABENGEWICHT[w.herkunft] * (w.bestaetigt === null ? 0.5 : 1);
    summe += w.wert * g;
    gewichte += g;
  }
  if (gewichte === 0) return null;
  return {
    wert: summe / gewichte,
    /*
     * Wie belastbar der zusammengefasste Wert ist.
     *
     * Eine einzelne Selbstauskunft ergibt 0,5 — eine Beobachtung plus
     * ein Gespräch 1,0. Der Aufrufer entscheidet damit, ob er die Zahl
     * überhaupt zeigt.
     */
    gewicht: Math.min(1, gewichte / 1.6),
  };
}
