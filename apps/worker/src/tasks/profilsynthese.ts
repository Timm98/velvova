import { loadRuntimeConfig } from "@paycheck/config";
import { getDb } from "@paycheck/db";
import { hintergrundSynthese, type Hintergrundbefund } from "@paycheck/jobs";
import {
  AiNotConfiguredError,
  modellFuer,
  preistafel,
  profilsyntheseRufer,
  PROFILSYNTHESE_FASSUNG,
  selectProvider,
} from "@paycheck/ai";

/**
 * Die Profilsynthese im Hintergrund.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum diese Aufgabe im bestehenden Arbeiter steht
 * ══════════════════════════════════════════════════════════════
 *
 * Weil es ihn schon gibt. Er läuft alle fünfzehn Minuten, er
 * verträgt einen Neustart, er protokolliert je Aufgabe eine Zeile,
 * und `--once` macht ihn zu einem Cron-Job. Ein zweiter Zeitplan
 * daneben — pg_cron, eine Edge Function, eine Warteschlange — wäre
 * ein zweiter Ort, an dem etwas hängen bleibt, und eine zweite
 * Antwort auf „läuft das eigentlich noch".
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie ohne Anbieter nicht scheitert, sondern schweigt
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Entwicklungsumgebung ohne API-Schlüssel ist der Normalfall,
 * kein Fehler. Fünf Zeilen Fehlermeldung alle fünfzehn Minuten sind
 * ein Grund, das Protokoll nicht mehr zu lesen — und dann fällt der
 * echte Fehler auch nicht auf.
 */

export interface Syntheselauf extends Hintergrundbefund {
  /** Ob überhaupt gelaufen wurde. */
  aktiv: boolean;
  grund?: string;
}

const RUHT: Omit<Syntheselauf, "grund"> = {
  aktiv: false,
  geprueft: 0,
  faellig: 0,
  bearbeitet: 0,
  gelungen: 0,
  fehlgeschlagen: 0,
  uebersprungen: 0,
  solAufrufe: 0,
  astraAufrufe: 0,
  dauerMs: 0,
  kostenCent: null,
  zurueckgehalten: {},
};

export interface Syntheseoptionen {
  /**
   * Nur diese Profile — für die ausdrückliche Bitte und für Proben.
   *
   * Ohne Angabe sucht der Lauf selbst, wer ansteht. Das ist der
   * Normalfall; die Einschränkung gibt es, damit „schau dir mein
   * Profil noch mal an" nicht bis zum nächsten Viertelstundentakt
   * warten muss.
   */
  nurProfile?: readonly string[];
  modellaufrufeMax?: number;
  ausdruecklich?: boolean;
}

export async function runProfilsynthese(
  optionen: Syntheseoptionen = {},
): Promise<Syntheselauf> {
  const cfg = loadRuntimeConfig();

  let provider;
  try {
    provider = await selectProvider(cfg);
  } catch (fehler) {
    if (fehler instanceof AiNotConfiguredError) {
      return { ...RUHT, grund: "kein Anbieter konfiguriert" };
    }
    throw fehler;
  }

  const db = await getDb();
  const { tafel, hinterlegt } = preistafel();

  /*
   * Der Aufruf selbst steht in `@paycheck/ai`.
   *
   * Der interne Endpunkt in `apps/web` braucht denselben Prompt, das
   * gleiche Schema, dieselbe Stufe und dieselbe Kostenrechnung.
   * Zweimal geschrieben wären sie einmal geändert und einmal
   * vergessen.
   */
  const stufe = modellFuer(cfg, "DEEP");

  const befund = await hintergrundSynthese(db, {
    nurProfile: optionen.nurProfile,
    modellaufrufeMax: optionen.modellaufrufeMax,
    ausdruecklich: optionen.ausdruecklich,
    promptFassung: PROFILSYNTHESE_FASSUNG,
    rufer: profilsyntheseRufer(provider, tafel, hinterlegt),
  });

  return { ...befund, aktiv: true, grund: `Modell ${stufe.modell}` };
}
