import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { firmennameNormalisieren, nameIstEindeutig, waechterPruefen, type Waechterbefund } from "@paycheck/domain";

/**
 * ══════════════════════════════════════════════════════════════════
 * Der Wächter — die Datenseite
 * ══════════════════════════════════════════════════════════════════
 *
 * Sucht Anzeigen des eigenen Arbeitgebers, die der eigenen Position
 * ähneln. Die Entscheidung, ob gewarnt wird, fällt nicht hier, sondern
 * in `waechterPruefen` — dort ist sie vollständig geprüft, und dort
 * gehört sie hin: Ob ein Mensch beunruhigt wird, darf nicht davon
 * abhängen, wie eine Abfrage formuliert ist.
 *
 * ── Was diese Datei entscheidet ─────────────────────────────────
 *
 * Nur, welche Anzeigen überhaupt vorgelegt werden. Das ist eine Frage
 * der Kosten, keine der Bedeutung.
 */

/** Wie weit zurück gesehen wird. */
export const FENSTER_TAGE = 14;

/** Wie viele Anzeigen einer Firma höchstens geprüft werden. */
const HOECHSTENS = 200;

export interface Arbeitsplatz {
  firma: string | null;
  position: string | null;
  /** Seit wann, für die Formulierung der Warnung. */
  seit: Date | null;
}

/**
 * Wo jemand gerade arbeitet — laut seinem eigenen Profil.
 *
 * Eine Erfahrung ohne Ende ist die laufende. Gibt es mehrere, gewinnt
 * die zuletzt begonnene: Wer zwei offene Einträge hat, hat den älteren
 * meist nur nicht abgeschlossen.
 */
export async function arbeitsplatzLaden(userId: string): Promise<Arbeitsplatz> {
  const db = await getDb();
  const [zeile] = await withUser(db, userId, (tx) =>
    tx
      .select({
        firma: schema.experiences.organisation,
        position: schema.experiences.title,
        seit: schema.experiences.startedOn,
      })
      .from(schema.experiences)
      .where(
        and(
          eq(schema.experiences.userId, userId),
          eq(schema.experiences.kind, "job"),
          isNull(schema.experiences.endedOn),
        ),
      )
      .orderBy(desc(schema.experiences.startedOn))
      .limit(1),
  );
  return zeile ?? { firma: null, position: null, seit: null };
}

export type Waechterlage =
  | { art: "warnungen"; treffer: Extract<Waechterbefund, { art: "warnung" }>[]; firma: string }
  | { art: "ruhig"; firma: string; geprueft: number }
  | { art: "nicht_moeglich"; grund: "kein_profil" | "firmenname_zu_unspezifisch" | "firma_unbekannt" };

/**
 * Hat der eigene Arbeitgeber etwas ausgeschrieben, das der eigenen
 * Stelle ähnelt?
 *
 * ── Warum „ruhig" ein eigener Zustand ist ───────────────────────
 *
 * Weil „nichts gefunden" und „konnte nicht nachsehen" für den
 * Menschen dasselbe aussehen und Gegenteiliges bedeuten. Ein Wächter,
 * der schweigt, weil er den Arbeitgeber nicht kennt, ist kein
 * Wächter — er sieht nur so aus.
 */
export async function waechterlauf(userId: string, fensterTage = FENSTER_TAGE): Promise<Waechterlage> {
  const platz = await arbeitsplatzLaden(userId);
  if (!platz.firma?.trim() || !platz.position?.trim()) {
    return { art: "nicht_moeglich", grund: "kein_profil" };
  }

  const normalisiert = firmennameNormalisieren(platz.firma);
  if (!nameIstEindeutig(normalisiert)) {
    return { art: "nicht_moeglich", grund: "firmenname_zu_unspezifisch" };
  }

  const db = await getDb();
  const seit = new Date(Date.now() - fensterTage * 24 * 3600 * 1000);

  /*
   * Erst die Firmen, dann ihre Anzeigen.
   *
   * Der Umweg über `companies` statt eines Textvergleichs auf `jobs`
   * ist der Unterschied zwischen einer Indexsuche über 421.395 Zeilen
   * und einem Durchlauf über Millionen. Gesucht wird weit — die
   * Entscheidung, ob es dieselbe Firma ist, fällt danach in
   * `waechterPruefen` und dort streng.
   */
  const firmen = await db
    .select({ id: schema.companies.id, name: schema.companies.name })
    .from(schema.companies)
    .where(sql`${schema.companies.name} ilike ${"%" + normalisiert.split(" ")[0] + "%"}`)
    .limit(50);

  const passende = firmen.filter((f) => firmennameNormalisieren(f.name) === normalisiert);
  if (passende.length === 0) {
    /*
     * Der Arbeitgeber steht in keiner Anzeige, die wir kennen.
     *
     * Das ist ausdrücklich NICHT „ruhig". Wer nie eine Stelle dieser
     * Firma gesehen hat, kann auch nicht sagen, dass sie keine
     * ausgeschrieben hat — und genau dieser Unterschied entscheidet,
     * ob ein Schweigen etwas wert ist.
     */
    return { art: "nicht_moeglich", grund: "firma_unbekannt" };
  }

  const anzeigen = await db
    .select({
      jobId: schema.jobs.id,
      titel: schema.jobs.title,
      firma: schema.companies.name,
      gesehenAm: schema.jobs.fetchedAt,
    })
    .from(schema.jobs)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
    .where(
      and(
        sql`${schema.jobs.companyId} in ${passende.map((f) => f.id)}`,
        gte(schema.jobs.fetchedAt, seit),
      ),
    )
    .limit(HOECHSTENS);

  const treffer = anzeigen
    .map((a) => waechterPruefen({ firma: platz.firma, position: platz.position }, a))
    .filter((b): b is Extract<Waechterbefund, { art: "warnung" }> => b.art === "warnung");

  if (treffer.length === 0) {
    return { art: "ruhig", firma: platz.firma, geprueft: anzeigen.length };
  }
  return { art: "warnungen", treffer, firma: platz.firma };
}
