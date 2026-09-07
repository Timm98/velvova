import type { AiTask } from "./router.ts";

/**
 * Wann eine Nachricht mehr ist als eine Nachricht.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Lücke, die das schliesst
 * ══════════════════════════════════════════════════════════════
 *
 * Im Chat stand: „Der Regelfall ist DEFAULT. Die tiefe Stufe wird
 * gezielt eskaliert, nicht standardmässig benutzt." Der Satz stimmte
 * zur Hälfte — DEFAULT war der Regelfall, und eskaliert wurde nie.
 *
 * Jede Frage lief über dasselbe Modell: „Hallo" genauso wie „soll ich
 * mit vier Jahren Einzelhandel in die IT wechseln, ohne Studium, bei
 * mindestens 70.000?"
 *
 * ══════════════════════════════════════════════════════════════
 * Warum kein Modell das entscheidet
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Aufruf, um zu klären, welcher Aufruf folgt, verdoppelt die
 * Wartezeit jeder Nachricht — für eine Frage, die meistens
 * offensichtlich ist. „Danke" braucht keine Analyse der Frage, ob es
 * eine Analyse braucht.
 *
 * Gemessen: gpt-4.1-mini 1,5 s, gpt-5-mini 5,6 s. Wer hier falsch
 * eskaliert, macht aus einer Rückfrage eine Wartezeit — und wer nie
 * eskaliert, lässt die gute Antwort ungenutzt.
 *
 * ══════════════════════════════════════════════════════════════
 * Woran man eine tiefe Frage erkennt
 * ══════════════════════════════════════════════════════════════
 *
 * Nicht an einzelnen Wörtern. „Karriere" steht auch in „wie läuft das
 * hier mit der Karriereseite". Erkennbar ist die Form der Frage:
 * Sie wägt ab, sie fragt nach Folgen, oder sie nennt eine
 * Lebensentscheidung.
 */

export type Gespraechstiefe = "flach" | "beratend" | "entscheidung";

export interface Gespraechsbefund {
  tiefe: Gespraechstiefe;
  aufgabe: AiTask;
  /** Welche Merkmale gefunden wurden — fürs Protokoll, nicht nur gedacht. */
  merkmale: string[];
}

/** Wendungen, die eine Abwägung ankündigen. */
const ABWAEGUNG: readonly [RegExp, string][] = [
  [/\b(soll ich|sollte ich|lohnt (es )?sich|wäre es (besser|sinnvoll))\b/i, "Abwägung"],
  [/\b(oder (soll|lieber)|was ist besser|vergleich|gegenüber)\b/i, "Vergleich"],
  [/\b(vor- und nachteile|dafür und dagegen|abwägen|entscheiden)\b/i, "Abwägung"],
  [/\b(welche (möglichkeiten|optionen|wege)|was käme.{0,12}in frage)\b/i, "Optionen"],
];

/** Wendungen, die eine Lebensentscheidung benennen. */
const ENTSCHEIDUNG: readonly [RegExp, string][] = [
  [/\b(branche|beruf|richtung)( )?(wechsel|wechseln|wechsle|ändern)\b/i, "Branchenwechsel"],
  [/\b(umschul|quereinstieg|neuanfang|neu anfangen|umorientier)/i, "Neuorientierung"],
  [/\b(kündigen|kündigung|aufhören|verlassen)\b/i, "Kündigung"],
  [/\b(selbstständig|selbständig|gründen)\b/i, "Selbstständigkeit"],
  [/\b(studium|studieren|weiterbildung|ausbildung anfangen)\b/i, "Ausbildungsweg"],
  [/\b(langfristig|in (fünf|5|zehn|10) jahren|zukunft meiner)\b/i, "Langfristigkeit"],
];

/** Wendungen, mit denen jemand ausdrücklich Gründlichkeit verlangt. */
const AUSDRUECKLICH: readonly [RegExp, string][] = [
  [/\b(ausführlich|gründlich|genau analysier|tiefer|im detail|detailliert)\b/i, "ausdrücklich"],
  [/\b(nimm dir zeit|denk (mal )?(gründlich|in ruhe) (darüber )?nach)\b/i, "ausdrücklich"],
];

/**
 * Wendungen, die eine Frage klein halten — auch wenn andere Merkmale
 * zutreffen.
 *
 * ── Warum das nötig ist ───────────────────────────────────────
 *
 * „Wo kann ich meinen Beruf ändern?" ist eine Frage nach einem Knopf,
 * keine Karriereentscheidung. Ohne diese Liste würde die Bedienhilfe
 * das teuerste Modell wecken.
 */
const BEDIENFRAGE =
  /\b(wo (finde|kann|sehe) ich|wie (ändere|lösche|speichere|stelle) ich .{0,20}(ein|um)?\b|einstellung(en)?|knopf|button|seite|funktioniert (die|das|der)\b)/i;

/** Sehr kurze Nachrichten sind fast nie eine Analyse. */
const KURZ_UNTER_ZEICHEN = 25;

function treffer(text: string, muster: readonly [RegExp, string][]): string[] {
  const raus: string[] = [];
  for (const [regex, name] of muster) if (regex.test(text) && !raus.includes(name)) raus.push(name);
  return raus;
}

/**
 * Wie tief eine Nachricht ist.
 *
 * ── Warum zwei Merkmale für die höchste Einstufung ────────────
 *
 * „Soll ich wechseln?" allein ist eine Frage, keine Analyse — Monday
 * fragt zurück, und das kann sie schnell. „Soll ich mit vier Jahren
 * Einzelhandel in die IT wechseln?" trägt Abwägung UND
 * Lebensentscheidung; da lohnt das gute Modell.
 */
export function gespraechstiefe(nachricht: string): Gespraechsbefund {
  const text = nachricht.trim();

  const flach: Gespraechsbefund = { tiefe: "flach", aufgabe: "conversation", merkmale: [] };
  if (text.length < KURZ_UNTER_ZEICHEN) return flach;

  /* Eine Bedienfrage bleibt eine Bedienfrage. */
  if (BEDIENFRAGE.test(text)) return { ...flach, merkmale: ["Bedienfrage"] };

  const ausdruecklich = treffer(text, AUSDRUECKLICH);
  if (ausdruecklich.length > 0) {
    /*
     * Eine ausdrückliche Bitte genügt allein. Das ist keine
     * Heuristik, sondern eine Aussage der Person.
     */
    return {
      tiefe: "entscheidung",
      aufgabe: "career_transition_analysis",
      merkmale: ausdruecklich,
    };
  }

  const abwaegung = treffer(text, ABWAEGUNG);
  const entscheidung = treffer(text, ENTSCHEIDUNG);
  const merkmale = [...abwaegung, ...entscheidung];

  if (abwaegung.length > 0 && entscheidung.length > 0) {
    return { tiefe: "entscheidung", aufgabe: "career_transition_analysis", merkmale };
  }
  if (merkmale.length > 0) {
    /*
     * Ein Merkmal allein: beratend, nicht entscheidend. Das ist immer
     * noch DEEP — aber `career_analysis` statt der vollen
     * Übergangsanalyse.
     */
    return { tiefe: "beratend", aufgabe: "career_analysis", merkmale };
  }

  return flach;
}
