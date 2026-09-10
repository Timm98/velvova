import { z } from "zod";

/**
 * ══════════════════════════════════════════════════════════════════
 * Wann man nach einem Wechsel fragt — und was dabeistehen muss
 * ══════════════════════════════════════════════════════════════════
 *
 * Bisher fragte Velvova nach 30, 90 und 180 Tagen. Die Begründung stand
 * im Code und klang plausibel: Hundertachtzig Tage liegen hinter der
 * Probezeit, und erst dort trenne sich, ob eine Empfehlung getaugt hat.
 *
 * Sie ist falsch, und zwar messbar.
 *
 * ── Der Honeymoon-Hangover-Effekt ───────────────────────────────
 *
 * Wer den Arbeitgeber wechselt, ist danach zufriedener — und zwar
 * unabhängig davon, ob die neue Stelle besser ist. Die Zufriedenheit
 * steigt im Jahr des Wechsels und fällt danach wieder ab (Boswell,
 * Boudreau & Tichy 2005; mit deutschen SOEP-Daten bestätigt bei Chadi
 * & Hetschko 2018). Der Abfall beginnt nach dem ersten Jahr.
 *
 * Wer nach 30, 90 und 180 Tagen misst, misst den Anstieg. Alle drei
 * Marken liegen im Hoch. Eine Empfehlung, die nach 180 Tagen gut
 * aussieht, kann nach zwölf Monaten gekippt sein — und genau dieser
 * Teil der Kurve war bisher unbeobachtet.
 *
 * ── Warum 30, 90, 365, 1095 ─────────────────────────────────────
 *
 *   30     Hat die Anzeige gestimmt? Das ist keine Frage nach
 *          Zufriedenheit, sondern nach Wahrheit — und die lässt sich
 *          nur früh beantworten, solange der Unterschied noch auffällt.
 *   90     Drei Monate. Trägt die Arbeit selbst.
 *   365    Zwölf Monate. Der Punkt, an dem die Kurve kippt.
 *   1095   Drei Jahre. Ob der Wechsel getragen hat.
 *
 * 180 fällt weg: zwischen 90 und 365 liegt kein eigener Befund, die
 * Marke sass mitten im Hoch. Alte Antworten bleiben, alte Erinnerungen
 * bleiben gültig — deshalb `ANGENOMMENE_MARKEN`.
 *
 * ── Warum eine Zahl ohne Kontext nichts wert ist ────────────────
 *
 * Die Forschung, aus der die Kurve stammt, misst nicht einfach
 * Zufriedenheit über Zeit. Sie trennt nach drei Dingen, und ohne diese
 * Trennung ist der Verlauf nicht deutbar:
 *
 *   Wechselgrund        Ein freiwilliger Wechsel und eine
 *                       Betriebsschliessung erzeugen verschiedene
 *                       Verläufe. Chadi & Hetschko trennen genau
 *                       daran — der unfreiwillige Fall ist ihr
 *                       Kontrollfall, weil er nicht ausgesucht ist.
 *   Berufsnähe          Ein Wechsel innerhalb des Berufs verläuft
 *                       anders als einer, der den Beruf verlässt.
 *   Ausbildungspassung  Überqualifikation senkt die Zufriedenheit
 *                       dauerhaft, unabhängig vom Wechsel.
 *
 * Ohne sie hat Velvova nach drei Jahren einen Mittelwert, aus dem sich
 * nichts folgern lässt. Mit ihnen hat es Daten, die sonst niemand hat.
 *
 * ── Warum das trotzdem freiwillig ist ───────────────────────────
 *
 * Der Wechselgrund kann eine Kündigung sein. Danach zu fragen ist
 * zumutbar, sie zu erzwingen nicht. Alle drei Angaben dürfen leer
 * bleiben; `null` heisst „nicht gesagt", nie ein Ersatzwert.
 */

/** Die Marken, an denen gefragt wird — in Tagen ab Antritt. */
export const MARKEN = [30, 90, 365, 1095] as const;
export type Marke = (typeof MARKEN)[number];

/**
 * Marken, die eine Antwort annehmen dürfen.
 *
 * 60 und 180 wurden früher geplant. Erinnerungen dazu liegen in der
 * Datenbank, und wer eine davon beantwortet, soll seine Antwort nicht
 * stillschweigend auf eine andere Marke gebucht bekommen.
 */
export const ANGENOMMENE_MARKEN = [30, 60, 90, 180, 365, 1095] as const;

export function markeAngenommen(tage: number): boolean {
  return (ANGENOMMENE_MARKEN as readonly number[]).includes(tage);
}

/**
 * Wie eine Marke im Satz heisst.
 *
 * „nach 1095 Tagen" rechnet niemand um. Ab einem Jahr wird gesagt, was
 * gemeint ist.
 */
export function markeText(tage: number): string {
  if (tage >= 1095) return "drei Jahren";
  if (tage >= 365) return "einem Jahr";
  if (tage % 30 === 0 && tage >= 90) return `${tage / 30} Monaten`;
  return `${tage} Tagen`;
}

export function checkInLabel(tage: number): string {
  return `Wie läuft es nach ${markeText(tage)}?`;
}

export function zusagenLabel(tage: number): string {
  return `Stimmt nach ${markeText(tage)}, was dir zugesagt wurde?`;
}

/**
 * Das Ereignis, das eine beantwortete Marke auslöst.
 *
 * Es wird nach unten gerundet, weil der Enum-Wert die erreichte Stufe
 * benennt — eine Antwort auf die 60-Tage-Erinnerung ist ein
 * Dreissig-Tage-Befund, kein Neunzig-Tage-Befund.
 */
export function ereignisFuerMarke(
  tage: number,
): "fit_check_30" | "fit_check_60" | "fit_check_90" | "fit_check_180" | "fit_check_365" | "fit_check_1095" {
  if (tage >= 1095) return "fit_check_1095";
  if (tage >= 365) return "fit_check_365";
  if (tage >= 180) return "fit_check_180";
  if (tage >= 90) return "fit_check_90";
  if (tage >= 60) return "fit_check_60";
  return "fit_check_30";
}

/** Die Spalte in `empfehlungs_ergebnisse`, in der die Marke landet. */
export function zufriedenheitsSpalte(
  tage: number,
): "zufriedenheit30" | "zufriedenheit90" | "zufriedenheit180" | "zufriedenheit365" | "zufriedenheit1095" {
  if (tage >= 1095) return "zufriedenheit1095";
  if (tage >= 365) return "zufriedenheit365";
  if (tage >= 180) return "zufriedenheit180";
  if (tage >= 90) return "zufriedenheit90";
  return "zufriedenheit30";
}

/* ── Die drei Angaben, ohne die der Verlauf nicht deutbar ist ── */

export const WechselgrundSchema = z.enum([
  /** Selbst gekündigt oder selbst gewechselt. Der ausgesuchte Fall. */
  "freiwillig",
  /** Kündigung durch den Arbeitgeber, Schliessung, Stellenabbau. */
  "betrieblich",
  /** Befristung ausgelaufen. */
  "befristung",
  /** Aus Arbeitslosigkeit heraus angetreten. */
  "aus_arbeitslosigkeit",
  /** Erste Stelle nach Ausbildung, Studium oder Pause. */
  "erster_einstieg",
]);
export type Wechselgrund = z.infer<typeof WechselgrundSchema>;

export const BerufsnaeheSchema = z.enum([
  /** Derselbe Beruf, anderer Arbeitgeber. */
  "gleicher_beruf",
  /** Verwandtes Feld — vieles gilt weiter, manches nicht. */
  "nachbarberuf",
  /** Ein anderer Beruf. */
  "neuer_beruf",
]);
export type Berufsnaehe = z.infer<typeof BerufsnaeheSchema>;

export const AusbildungspassungSchema = z.enum([
  /** Mehr mitgebracht, als die Stelle verlangt. */
  "ueberqualifiziert",
  "passend",
  /** Weniger mitgebracht — der Aufstieg über die eigene Ausbildung hinaus. */
  "unterqualifiziert",
]);
export type Ausbildungspassung = z.infer<typeof AusbildungspassungSchema>;

/**
 * Der Wechselkontext einer angetretenen Stelle.
 *
 * Gehört zum Wechsel, nicht zum einzelnen Check-in: Er wird einmal
 * erfragt und auf jede spätere Antwort mitgeschrieben, damit eine Zeile
 * für sich allein deutbar bleibt.
 */
export interface Wechselkontext {
  wechselgrund: Wechselgrund | null;
  berufsnaehe: Berufsnaehe | null;
  ausbildungspassung: Ausbildungspassung | null;
}

export const LEER: Wechselkontext = {
  wechselgrund: null,
  berufsnaehe: null,
  ausbildungspassung: null,
};

/**
 * Nimmt an, was gültig ist, und verwirft still, was es nicht ist.
 *
 * Ein unbekannter Wert aus einem Formular darf keinen Check-in
 * verhindern — die Zahl ist das Wichtige, der Kontext das Zusätzliche.
 */
export function kontextLesen(roh: {
  wechselgrund?: string | null;
  berufsnaehe?: string | null;
  ausbildungspassung?: string | null;
}): Wechselkontext {
  return {
    wechselgrund: WechselgrundSchema.safeParse(roh.wechselgrund).data ?? null,
    berufsnaehe: BerufsnaeheSchema.safeParse(roh.berufsnaehe).data ?? null,
    ausbildungspassung: AusbildungspassungSchema.safeParse(roh.ausbildungspassung).data ?? null,
  };
}

/** true, wenn zu diesem Wechsel noch gar nichts bekannt ist. */
export function kontextFehlt(k: Wechselkontext): boolean {
  return k.wechselgrund === null && k.berufsnaehe === null && k.ausbildungspassung === null;
}

/**
 * Was schon bekannt ist, bleibt stehen.
 *
 * Der Kontext wird bei jedem Check-in mitgeschrieben. Wer ihn beim
 * ersten Mal genannt hat und beim zweiten Mal nichts sagt, soll ihn
 * nicht verlieren.
 */
export function kontextFortschreiben(alt: Wechselkontext, neu: Wechselkontext): Wechselkontext {
  return {
    wechselgrund: neu.wechselgrund ?? alt.wechselgrund,
    berufsnaehe: neu.berufsnaehe ?? alt.berufsnaehe,
    ausbildungspassung: neu.ausbildungspassung ?? alt.ausbildungspassung,
  };
}

/* ── Wortlaut für die Oberfläche ── */

export const WECHSELGRUND_WORTE: ReadonlyArray<{ wert: Wechselgrund; wort: string }> = [
  { wert: "freiwillig", wort: "Ich habe selbst gewechselt" },
  { wert: "betrieblich", wort: "Gekündigt worden oder Stelle weggefallen" },
  { wert: "befristung", wort: "Befristung lief aus" },
  { wert: "aus_arbeitslosigkeit", wort: "Aus der Arbeitslosigkeit heraus" },
  { wert: "erster_einstieg", wort: "Erste Stelle nach Ausbildung oder Pause" },
];

export const BERUFSNAEHE_WORTE: ReadonlyArray<{ wert: Berufsnaehe; wort: string }> = [
  { wert: "gleicher_beruf", wort: "Derselbe Beruf" },
  { wert: "nachbarberuf", wort: "Verwandtes Feld" },
  { wert: "neuer_beruf", wort: "Ein anderer Beruf" },
];

export const AUSBILDUNGSPASSUNG_WORTE: ReadonlyArray<{
  wert: Ausbildungspassung;
  wort: string;
}> = [
  { wert: "ueberqualifiziert", wort: "Mehr, als die Stelle verlangt" },
  { wert: "passend", wort: "Passt zu meiner Ausbildung" },
  { wert: "unterqualifiziert", wort: "Weniger — ein Schritt nach oben" },
];
