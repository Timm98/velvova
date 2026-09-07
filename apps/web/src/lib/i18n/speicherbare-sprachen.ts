import { sql } from "drizzle-orm";
import { getDb } from "@paycheck/db";
import { ninaSprachen, type LocaleEintrag } from "@paycheck/i18n";

/**
 * Welche Sprachen die Datenbank wirklich annimmt.
 *
 * Das Register kennt zwölf Sprachen (V7 §20.2). Der Aufzählungstyp
 * `locale` in Postgres kannte lange zwei. Böte die Oberfläche alle
 * zwölf an, während die Datenbank zwei akzeptiert, wäre das Ergebnis
 * eine Auswahl, die beim Speichern scheitert — und zwar erst nach dem
 * Klick, mit einer Fehlermeldung aus dem Treiber.
 *
 * Statt dessen wird gefragt. `enum_range` ist die Wahrheit über das,
 * was gespeichert werden kann; ein Konstante im Code wäre eine
 * Behauptung darüber, ob eine Migration gelaufen ist.
 *
 * Damit funktioniert die Seite in beiden Zuständen richtig: vor der
 * Migration zeigt sie zwei Sprachen, danach zwölf — ohne dass jemand
 * eine zweite Stelle nachziehen muss.
 */

let gemerkt: Set<string> | null = null;

async function speicherbareCodes(): Promise<Set<string>> {
  if (gemerkt) return gemerkt;
  try {
    const db = await getDb();
    const ergebnis = (await db.execute(
      sql`SELECT unnest(enum_range(NULL::locale))::text AS code`,
    )) as unknown as { rows: { code: string }[] };
    gemerkt = new Set(ergebnis.rows.map((r) => r.code));
  } catch {
    /*
     * Kein Zugriff, kein Typ, kein Postgres — dann die beiden, die es
     * seit jeher gibt. Lieber eine zu kleine Auswahl als eine, die beim
     * Speichern bricht.
     */
    gemerkt = new Set(["de", "en"]);
  }
  return gemerkt;
}

/** Sprachen für Mondays Gespräch und für Unterlagen. */
export async function speicherbareSprachen(): Promise<LocaleEintrag[]> {
  const erlaubt = await speicherbareCodes();
  return ninaSprachen().filter((l) => erlaubt.has(l.code));
}

/** Wie viele Sprachen aus dem Register noch nicht gespeichert werden können. */
export async function nochNichtSpeicherbar(): Promise<number> {
  const erlaubt = await speicherbareCodes();
  return ninaSprachen().filter((l) => !erlaubt.has(l.code)).length;
}
