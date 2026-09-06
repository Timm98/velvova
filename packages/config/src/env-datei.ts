import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * `.env.local` für Programme, die kein Next starten.
 *
 * ── Was hier schiefging ───────────────────────────────────────
 *
 * Der Entwicklungsserver liest `.env.local` von sich aus. Skripte und
 * Kommandozeilenprogramme nicht — und das fiel monatelang nicht auf,
 * weil beide trotzdem liefen.
 *
 * `pnpm jobs:refresh` sah deshalb keinen einzigen Schlüssel. Alle
 * Anbieter, die einen brauchen, meldeten „Zugangsdaten fehlen" und
 * wurden übersprungen; nur die schlüsselfreie Quelle lief. Schlimmer:
 * ohne `DATABASE_URL` fiel der Treiber auf die eingebettete Datenbank
 * zurück, und der Lauf schrieb seine Ergebnisse in eine lokale Datei
 * statt nach Supabase.
 *
 * Beides ohne Fehlermeldung. Der Lauf meldete „10 neu" und war
 * erfolgreich — nur eben in der falschen Datenbank, aus einer einzigen
 * Quelle. Es gibt keinen Zustand, an dem man das ablesen könnte; man
 * muss danach suchen.
 *
 * ── Warum das nicht in `currentEnv()` gehört ──────────────────
 *
 * `packages/config` wird auch im Browser und in der Edge-Laufzeit
 * geladen, wo es weder ein Dateisystem noch `.env.local` gibt. Diese
 * Datei ist deshalb ein eigener Einstiegspunkt, den ausdrücklich nur
 * Node-Programme aufrufen.
 */

/**
 * Sucht die Wurzel des Arbeitsbereichs.
 *
 * Über `pnpm-workspace.yaml`, nicht über `package.json`: die gibt es in
 * jedem Paket, und ein Skript, das aus einem Unterverzeichnis läuft,
 * fände die falsche.
 */
function arbeitsbereichswurzel(start: string): string | null {
  let dir = resolve(start);
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const oben = dirname(dir);
    if (oben === dir) break;
    dir = oben;
  }
  return null;
}

/**
 * Lädt `.env.local`, wenn es eine gibt.
 *
 * Wirft nie. In der Produktion kommen die Werte von der Plattform, dort
 * existiert die Datei nicht — und ein Programm, das deshalb nicht
 * startet, wäre die schlechtere Antwort.
 *
 * Gibt zurück, ob geladen wurde. Aufrufer können das melden, statt es
 * zu vermuten.
 */
export function ladeEnvDatei(von = process.cwd()): { geladen: boolean; pfad: string | null } {
  const wurzel = arbeitsbereichswurzel(von);
  if (!wurzel) return { geladen: false, pfad: null };

  const pfad = join(wurzel, ".env.local");
  if (!existsSync(pfad)) return { geladen: false, pfad: null };

  try {
    // Seit Node 20.12 eingebaut. Kein Paket nötig, und damit auch keine
    // Abhängigkeit, die Secrets zu Gesicht bekommt.
    process.loadEnvFile(pfad);
    return { geladen: true, pfad };
  } catch {
    return { geladen: false, pfad: null };
  }
}
