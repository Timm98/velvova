import { z } from "zod";
import { AiNotConfiguredError, selectProvider } from "@paycheck/ai";
import { alsWert, FELDER, type OnboardingFeld } from "./felder";
import type { Fund } from "./leser";

/**
 * Die zweite Stufe: das Modell liest, was die Regeln nicht erreichen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das Modell nur die Lücken bekommt
 * ══════════════════════════════════════════════════════════════
 *
 * „65.000 bis 80.000 Euro“ liest eine Regel richtig oder gar nicht.
 * Ein Modell liest es meistens richtig — und der Unterschied zwischen
 * „meistens“ und „immer“ landet ungeprüft in einer Stellenanzeige.
 *
 * Deshalb läuft `lies()` zuerst und das Modell nur auf dem Rest. Was
 * die Regeln gefunden haben, wird dem Modell nicht einmal zur
 * Bestätigung vorgelegt: Es könnte widersprechen, und dann stünde eine
 * Frage im Raum, die niemand entscheiden kann.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Funde des Modells „abgeleitet“ heissen
 * ══════════════════════════════════════════════════════════════
 *
 * `status: "abgeleitet"` zählt in `bewertung.ts` als halber Punkt und
 * erscheint in der Oberfläche als „Nina hat verstanden — stimmt das?“.
 * Das ist die ehrliche Beschreibung: Ein Mensch hat es nicht gesagt,
 * eine Maschine hat es geschlossen.
 *
 * Zwingende Felder bleiben davon unberührt — sie deckeln die
 * Vollständigkeit bei 95 %, solange sie nicht bestätigt sind. Ein
 * Onboarding lässt sich also nicht dadurch abschliessen, dass ein
 * Modell die Lücken füllt.
 */

/** Was das Modell zurückgeben darf — mehr nicht. */
const ANTWORT = z.object({
  angaben: z
    .array(
      z.object({
        bereich: z.string(),
        feld: z.string(),
        /* Als Text, nicht als beliebiges JSON. Die Umwandlung in Zahl,
           Liste oder Spanne passiert hier unten anhand der Feldart —
           das Modell soll den Satz lesen, nicht das Datenformat
           erfinden. */
        wert: z.string(),
        belegstelle: z
          .string()
          .describe("Der Wortlaut aus der Antwort, auf den sich der Wert stützt."),
        sicher: z
          .boolean()
          .describe("Steht es so da, oder ist es geschlossen? Im Zweifel false."),
      }),
    )
    .describe("Nur Felder, die in der Antwort wirklich vorkommen. Leer ist eine gültige Antwort."),
});

/**
 * Die Anweisung.
 *
 * Der wichtigste Satz ist der über das Nichtsagen. Ohne ihn füllt ein
 * Modell die Liste, weil eine Liste zu füllen die Aufgabe zu sein
 * scheint.
 */
function anweisung(offen: OnboardingFeld[]): string {
  const liste = offen
    .map((f) => `- ${f.bereich}.${f.feld} — ${f.label} (${f.art})`)
    .join("\n");

  return [
    "Du liest die Antwort eines Arbeitgebers und ordnest zu, was darin über die offenen Felder steht.",
    "",
    "Regeln:",
    "1. Gib ein Feld nur zurück, wenn die Antwort es wirklich benennt. Ein leeres Ergebnis ist richtig, wenn nichts dasteht.",
    "2. Erfinde keine Werte, runde nichts auf, ergänze nichts aus Erfahrung mit ähnlichen Unternehmen.",
    "3. Trenne Pflicht von Wunsch. „möglichst“, „idealerweise“, „von Vorteil“ heisst Wunsch, nicht Muss.",
    "4. „weiss nicht“, „müsste ich klären“, „kommt darauf an“ sind keine Werte.",
    "5. Jede Angabe braucht eine Belegstelle aus dem Wortlaut. Findest du keine, gib die Angabe nicht zurück.",
    "6. `sicher` ist nur true, wenn es wörtlich dasteht. Alles Geschlossene ist false.",
    "",
    "Offene Felder:",
    liste,
  ].join("\n");
}

export type DeutungsErgebnis = {
  funde: Fund[];
  /** Warum nichts kam — für die Oberfläche, nicht für den Nutzer. */
  grund: "gedeutet" | "kein_modell" | "nichts_offen" | "fehler";
};

/**
 * Die Lücken deuten.
 *
 * Bekommt den Text und die bereits gefundenen Felder. Läuft nur über
 * das, was danach noch offen ist.
 */
export async function deute(opt: {
  text: string;
  bereitsGefunden: { bereich: string; feld: string }[];
  signal?: AbortSignal;
}): Promise<DeutungsErgebnis> {
  const belegt = new Set(opt.bereitsGefunden.map((f) => `${f.bereich}.${f.feld}`));
  const offen = FELDER.filter((f) => !belegt.has(`${f.bereich}.${f.feld}`));
  if (offen.length === 0) return { funde: [], grund: "nichts_offen" };

  let provider;
  try {
    provider = await selectProvider();
  } catch (fehler) {
    /*
     * Ohne Schlüssel läuft das Onboarding weiter — mit dem, was die
     * Regeln gelesen haben. Nina fragt dann eben nach. Das ist der
     * schlechtere, aber ein vollständig funktionierender Weg; ein
     * harter Fehler an dieser Stelle würde ein Gespräch abbrechen,
     * das gar nicht auf das Modell angewiesen ist.
     */
    if (fehler instanceof AiNotConfiguredError) return { funde: [], grund: "kein_modell" };
    throw fehler;
  }

  let antwort;
  try {
    antwort = await provider.structuredGenerate({
      system: anweisung(offen),
      messages: [{ role: "user", content: opt.text }],
      schema: ANTWORT,
      schemaName: "onboarding_angaben",
      /* Extraktion, kein Gespräch — das schnelle Modell. */
      tier: "fast",
      temperature: 0,
      signal: opt.signal,
    });
  } catch {
    /* Zeitüberschreitung, Kontingent, Netz. Dasselbe wie oben: Das
       Gespräch läuft ohne die Deutung weiter. */
    return { funde: [], grund: "fehler" };
  }

  const funde: Fund[] = [];
  const gesehen = new Set<string>();

  for (const a of antwort.data.angaben) {
    const schluessel = `${a.bereich}.${a.feld}`;

    /* Ein Feld, das die Regeln schon haben, wird nicht überschrieben —
       auch nicht, wenn das Modell es trotz der Liste zurückgibt. */
    if (belegt.has(schluessel) || gesehen.has(schluessel)) continue;

    const feld = offen.find((f) => f.bereich === a.bereich && f.feld === a.feld);
    if (!feld) continue;

    /* Ohne Beleg keine Angabe — Regel 5 wird hier durchgesetzt und
       nicht nur erbeten. */
    const beleg = a.belegstelle.trim();
    if (beleg.length === 0) continue;

    const wert = alsWert(feld, a.wert);
    if (wert === null) continue;

    gesehen.add(schluessel);
    funde.push({
      bereich: a.bereich,
      feld: a.feld,
      wert,
      quelle: "gespraech",
      /*
       * Auch ein wörtlicher Fund des Modells bleibt „abgeleitet“.
       *
       * `gefunden` ist für die Regeln reserviert, weil sich deren
       * Treffer nachvollziehen lassen: dieselbe Eingabe ergibt
       * dieselbe Ausgabe. Für das Modell gilt das nicht, und der
       * Unterschied gehört sichtbar in die Daten.
       */
      status: "abgeleitet",
      konfidenz: a.sicher ? 65 : 45,
      belegstelle: beleg,
    });
  }

  return { funde, grund: "gedeutet" };
}

/**
 * Beide Stufen zusammen — die Reihenfolge ist die Aussage.
 */
export async function verstehe(opt: {
  text: string;
  signal?: AbortSignal;
}): Promise<{ funde: Fund[]; gedeutet: boolean }> {
  const { lies } = await import("./leser");
  const ausRegeln = lies(opt.text);

  const { funde: ausModell, grund } = await deute({
    text: opt.text,
    bereitsGefunden: ausRegeln,
    signal: opt.signal,
  });

  return { funde: [...ausRegeln, ...ausModell], gedeutet: grund === "gedeutet" };
}
