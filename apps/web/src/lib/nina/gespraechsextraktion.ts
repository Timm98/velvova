import "server-only";

import { z } from "zod";
import { AiNotConfiguredError, selectProvider } from "@paycheck/ai";

/**
 * Aus einem Satz strukturierte Karriereangaben gewinnen.
 *
 * ══════════════════════════════════════════════════════════════
 * Was das Modell darf und was nicht
 * ══════════════════════════════════════════════════════════════
 *
 * Es darf lesen: Zahlen, Bedingungen, Wünsche, und ob etwas als
 * Bedingung oder als Vorliebe gemeint war.
 *
 * Es darf NICHT entscheiden, ob eine Angabe eine bestehende ersetzt.
 * Das macht `faktenregeln.ts`, und zwar nach einer Regel, die man
 * lesen und prüfen kann. Ein Modell, das über die Wahrheit im Profil
 * entscheidet, trifft Entscheidungen, die niemand nachvollziehen
 * kann — und die sich bei identischer Eingabe beim nächsten Mal
 * anders ergeben.
 *
 * Es darf auch NICHT einen Match-Score erfinden. Das steht hier,
 * obwohl es diese Datei gar nicht betrifft, weil es dieselbe Grenze
 * ist: Das Modell versteht Sprache, das Backend rechnet.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum Schema-Ausgabe statt Textauswertung
 * ══════════════════════════════════════════════════════════════
 *
 * „Antworte im Format …“ und danach mit regulären Ausdrücken suchen
 * heisst: Beim ersten Modell, das ein Feld weglässt oder anders
 * benennt, entstehen stillschweigend falsche Werte. Mit einem Schema
 * schlägt der Aufruf fehl, und das ist der bessere Ausgang.
 */

/** Die Bedingung, wie das Modell sie liefert. */
const BEDINGUNG = z.object({
  /*
   * Der Schlüssel ist eine Auswahl, keine freie Zeichenkette.
   *
   * Ein Modell, das „min_salary“, „mindestgehalt“ und
   * „gehalt_minimum“ abwechselnd liefert, füllt das Gedächtnis mit
   * drei Einträgen für dieselbe Sache — und keiner davon findet den
   * anderen.
   */
  schluessel: z.enum([
    "mindestgehalt",
    "wunschgehalt",
    "aktuelles_gehalt",
    "mindest_remote_tage",
    "max_pendelzeit",
    "arbeitsort",
    "wochenstunden",
    "vertragsart",
    "branche_gewuenscht",
    "branche_ausgeschlossen",
    "fuehrungsverantwortung",
    "schichtarbeit",
    "reisebereitschaft",
    "kundenkontakt",
    "wechselbereitschaft",
  ]),
  wert: z.union([z.number(), z.string(), z.boolean()]),
  /**
   * Ob es als Bedingung gemeint war.
   *
   * „Zwei Tage Homeoffice wären schon Pflicht“ ist eine Bedingung.
   * „Wären schön“ ist keine. Das Wort davor entscheidet, und diese
   * Unterscheidung ist die eigentliche Arbeit dieser Extraktion —
   * eine falsch als hart gelesene Vorliebe schliesst Stellen aus, die
   * jemand gern gesehen hätte.
   */
  harteBedingung: z.boolean(),
  konfidenz: z.number().min(0).max(1),
  belegstelle: z.string().describe("Der Wortlaut, auf den sich das stützt."),
});

const ANTWORT = z.object({
  bedingungen: z
    .array(BEDINGUNG)
    .describe("Nur, was wirklich gesagt wurde. Leer ist eine gültige Antwort."),
});

export type GeleseneBedingung = z.infer<typeof BEDINGUNG>;

const ANWEISUNG = [
  "Du liest die Antwort eines Menschen über seine berufliche Situation und Wünsche.",
  "",
  "Regeln:",
  "1. Gib nur zurück, was wirklich dasteht. Ein leeres Ergebnis ist richtig, wenn nichts gesagt wurde.",
  "2. Unterscheide Bedingung von Wunsch. „muss“, „Pflicht“, „mindestens“, „unter … nicht“ sind Bedingungen. „gern“, „wäre schön“, „idealerweise“, „eigentlich“ sind Wünsche.",
  "3. Erfinde keine Zahlen und runde nicht. „so um die 60“ ist 60000, nicht 62000.",
  "4. „62k“ sind 62000. „unter 70 nicht wechseln“ heisst mindestgehalt 70000.",
  "5. Jede Angabe braucht eine Belegstelle aus dem Wortlaut. Ohne Beleg gib sie nicht zurück.",
  "6. Bei Unsicherheit über hart oder weich: weich. Eine zu Unrecht harte Bedingung schliesst Stellen aus.",
].join("\n");

export type Extraktionsergebnis =
  | { ok: true; bedingungen: GeleseneBedingung[] }
  | { ok: false; grund: "kein_modell" | "fehler" };

export async function bedingungenLesen(text: string): Promise<Extraktionsergebnis> {
  if (text.trim().length < 3) return { ok: true, bedingungen: [] };

  let provider;
  try {
    provider = await selectProvider();
  } catch (fehler) {
    /* Ohne Modell läuft das Gespräch weiter — Nina fragt dann eben
       nach, statt zu lesen. Ein harter Fehler bräche ein Gespräch ab,
       das gar nicht auf das Modell angewiesen ist. */
    if (fehler instanceof AiNotConfiguredError) return { ok: false, grund: "kein_modell" };
    throw fehler;
  }

  try {
    const antwort = await provider.structuredGenerate({
      system: ANWEISUNG,
      messages: [{ role: "user", content: text.slice(0, 4000) }],
      schema: ANTWORT,
      schemaName: "karriere_bedingungen",
      tier: "fast",
      temperature: 0,
    });
    return {
      ok: true,
      /* Ohne Belegstelle keine Angabe — Regel 5 wird hier
         durchgesetzt und nicht nur erbeten. */
      bedingungen: antwort.data.bedingungen.filter((b) => b.belegstelle.trim().length > 0),
    };
  } catch {
    return { ok: false, grund: "fehler" };
  }
}

/**
 * Aus einer gelesenen Bedingung ein Fakt-Wunsch.
 *
 * ── Warum die Konfidenz hier gedeckelt wird ───────────────────
 *
 * Das Modell gibt 0 bis 1 an und ist dabei regelmässig zu
 * zuversichtlich. Der Deckel bei 85 sorgt dafür, dass eine Extraktion
 * nie so belastbar wirkt wie eine Angabe, die ein Mensch selbst
 * bestätigt hat — und genau darauf beruht die Regel in
 * `faktenregeln.ts`.
 */
export function alsFaktwunsch(b: GeleseneBedingung) {
  return {
    art: b.harteBedingung ? "bedingung" : "praeferenz",
    schluessel: b.schluessel,
    wert: b.wert,
    quelle: "gespraech" as const,
    konfidenz: Math.min(85, Math.round(b.konfidenz * 100)),
    bestaetigt: false,
    beleg: b.belegstelle,
  };
}
