import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { schema, withUser, type Database } from "@paycheck/db";
import type { Klaerungsstand, Stellenlage } from "@paycheck/matching";
import { offeneKlaerungen } from "../intelligenz/synthese.ts";
import { belegstandLaden } from "../intelligenz/belege.ts";
import { BELEGE_FUER_ANALYSE, hinweisAus } from "../intelligenz/karriere.ts";

/**
 * Was die Intelligenzschicht der Proaktiv-Engine zu bieten hat.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum diese Datei zwischen beiden steht
 * ══════════════════════════════════════════════════════════════
 *
 * `packages/matching` rechnet und kennt keine Datenbank. Die
 * Proaktiv-Engine dort weiss deshalb nicht, wie oft ein Widerspruch
 * schon angesprochen wurde — und ohne diese Zahl gäbe es keine
 * Entdopplung, sondern nur eine Wiederholung im Wochentakt.
 *
 * Diese Datei holt, was die Rechnung braucht. Sie entscheidet nichts.
 */

/**
 * Die offenen Klärungen, mit der Zahl der bisherigen Anläufe.
 *
 * ── Warum die Zahl aus `nina_handlungen` kommt ────────────────
 *
 * Weil dort steht, was Nina tatsächlich GESAGT hat — `gezeigt_am`
 * wird gesetzt, wenn die Nachricht die Person erreicht hat. Ein
 * Zähler an der Klärung selbst würde zählen, was Nina sagen WOLLTE,
 * und das sind zwei verschiedene Zahlen: Die meisten Gelegenheiten
 * sterben in der Zurückhaltung, ohne dass jemand sie gesehen hat.
 */
export async function klaerungsstaendeLaden(
  db: Database,
  userId: string,
): Promise<Klaerungsstand[]> {
  const offen = await offeneKlaerungen(db, userId);
  if (offen.length === 0) return [];

  const gezeigt = await withUser(db, userId, (tx) =>
    tx
      .select({
        schluessel: schema.ninaHandlungen.schluessel,
        n: sql<number>`count(*)::int`,
      })
      .from(schema.ninaHandlungen)
      .where(
        and(
          eq(schema.ninaHandlungen.userId, userId),
          isNotNull(schema.ninaHandlungen.schluessel),
          isNotNull(schema.ninaHandlungen.gezeigtAm),
        ),
      )
      .groupBy(schema.ninaHandlungen.schluessel),
  );

  const male = new Map(gezeigt.map((z) => [z.schluessel ?? "", Number(z.n)]));

  return offen.map((k) => ({
    art: k.art,
    schluessel: k.schluessel,
    frage: k.frage,
    staerke: k.staerke,
    malGezeigt: male.get(k.schluessel) ?? 0,
  }));
}

/* ═══════════════════════════════════════════════════════════════
   Die Stellenlage
   ═══════════════════════════════════════════════════════════════ */

/**
 * Wie viele Stellen höchstens angesehen werden.
 *
 * Eine Meldung entsteht aus höchstens einer blockierten Stelle und
 * einer Handvoll starker Treffer. Mehr zu laden hiesse, eine
 * Datenbankabfrage für Zeilen zu bezahlen, die niemand liest.
 */
const STELLEN_GRENZE = 20;

/**
 * Was an der Stellenlage erwähnenswert ist.
 *
 * ── Warum `match_factors` und nicht eine eigene Rechnung ──────
 *
 * Weil die Bewertung dort bereits steht, mit `art` und `schwere` je
 * Faktor. Sie hier nachzurechnen ergäbe eine zweite Zahl neben der,
 * die die Person in der Stellenliste sieht — und irgendwann
 * widersprächen sie einander.
 *
 * Das ist derselbe Fehler wie „Nina-Analyse erfindet Zahlen, die
 * oben nicht stehen": zwei Rechnungen für dieselbe Frage.
 */
export async function stellenlageLaden(
  db: Database,
  userId: string,
  seit: Date,
): Promise<Stellenlage> {
  /*
   * ══════════════════════════════════════════════════════════════
   * `coalesce(overall, fit)` — und warum keine eigene Zahl
   * ══════════════════════════════════════════════════════════════
   *
   * Die Person sieht in der Stellenliste eine Zahl. Hier eine zweite
   * zu rechnen hiesse, ihr gleich zwei verschiedene Antworten auf
   * dieselbe Frage zu geben — genau der Fehler, der in der
   * Stellenansicht schon einmal auffiel („Nina erfindet Zahlen, die
   * oben nicht stehen").
   *
   * Beide Spalten kommen aus derselben Bewertung; `overall` ist die
   * zusammengefasste, `fit` die Passung allein. Welche gefüllt ist,
   * hängt an der Datenlage der Person — gemessen am 6. September
   * 2026: in 45 gespeicherten Bewertungen keine von beiden, weil
   * kein Profil vollständig genug für eine Punktzahl war.
   *
   * Diese Abfrage liefert dann nichts. Das ist richtig so: Ohne
   * Punktzahl lässt sich nicht sagen, ob eine Stelle „ungewöhnlich
   * gut" passt, und eine geratene Zahl wäre schlimmer als Schweigen.
   */
  const blockiert = (await withUser(db, userId, (tx) =>
    tx.execute(sql`
      select m.job_id, j.title,
             coalesce(m.overall_score, m.fit_score) as passung,
             f.explanation
        from job_matches m
        join jobs j on j.id = m.job_id
        join match_factors f on f.match_id = m.id
       where m.user_id = ${userId}
         and f.art = 'blocker'
         and coalesce(m.overall_score, m.fit_score) is not null
       order by coalesce(m.overall_score, m.fit_score) desc
       limit ${STELLEN_GRENZE}
    `),
  )) as unknown as { rows: Record<string, unknown>[] };

  const gesehen = new Set<string>();
  const harteKonflikte = blockiert.rows
    .filter((z) => {
      const id = String(z.job_id);
      if (gesehen.has(id)) return false;
      gesehen.add(id);
      return true;
    })
    .map((z) => ({
      jobId: String(z.job_id),
      titel: String(z.title),
      einwand: String(z.explanation ?? "eine deiner Bedingungen ist nicht erfüllt."),
      passung: Number(z.passung ?? 0),
    }));

  const frisch = await withUser(db, userId, (tx) =>
    tx
      .select({
        jobId: schema.jobMatches.jobId,
        titel: schema.jobs.title,
        passung: sql<number | null>`coalesce(${schema.jobMatches.overallScore}, ${schema.jobMatches.fitScore})`,
      })
      .from(schema.jobMatches)
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.jobMatches.jobId))
      .where(
        and(
          eq(schema.jobMatches.userId, userId),
          gte(schema.jobMatches.computedAt, seit),
          /*
           * `eligible` heisst: keine Muss-Bedingung verletzt. Eine
           * Stelle, die an einer Bedingung scheitert, ist kein starker
           * Treffer — auch nicht bei hoher Punktzahl. Der Fall hat
           * seinen eigenen Weg, oben.
           */
          eq(schema.jobMatches.constraintVerdict, "eligible"),
        ),
      )
      .orderBy(desc(sql`coalesce(${schema.jobMatches.overallScore}, ${schema.jobMatches.fitScore})`))
      .limit(STELLEN_GRENZE),
  );

  return {
    harteKonflikte,
    starkeTreffer: frisch
      .filter((z) => typeof z.passung === "number")
      .map((z) => ({ jobId: z.jobId, titel: z.titel, passung: z.passung! })),
  };
}

/* ═══════════════════════════════════════════════════════════════
   Die Lage der Karriereanalyse
   ═══════════════════════════════════════════════════════════════ */

export interface Analyselage {
  /** Der Satz aus einer uneinigen Analyse, oder `null`. */
  unsicherheit: string | null;
  /**
   * Ob eine Karriereanalyse an fehlenden Angaben scheitert.
   *
   * Der Fall aus dem Auftrag: „Karriereentscheidung blockiert durch
   * genau eine wichtige Information." Dann ist die nächste Frage
   * nicht Neugier, sondern der Weg aus der Sackgasse — und sie darf
   * unterbrechen.
   */
  analyseBlockiert: boolean;
}

export async function analyselageLaden(db: Database, userId: string): Promise<Analyselage> {
  const [letzte] = await withUser(db, userId, (tx) =>
    tx
      .select({
        einig: schema.profilSynthesen.einig,
        abweichungen: schema.profilSynthesen.abweichungen,
      })
      .from(schema.profilSynthesen)
      .where(
        and(
          eq(schema.profilSynthesen.userId, userId),
          eq(schema.profilSynthesen.art, "karriereanalyse"),
        ),
      )
      .orderBy(desc(schema.profilSynthesen.erstelltAm))
      .limit(1),
  );

  const unsicherheit = letzte
    ? hinweisAus(letzte.einig, (letzte.abweichungen ?? []) as { feld: string }[])
    : null;

  /*
   * Blockiert heisst: Es liegt etwas vor, aber zu wenig.
   *
   * Bei null Belegen ist nichts blockiert — dann hat noch kein
   * Gespräch stattgefunden, und eine Frage aus dem Hintergrund wäre
   * eine Ansprache ohne Anlass.
   */
  const stand = await belegstandLaden(db, userId);
  const tragend = stand.belege.filter((b) => b.konfidenz >= 0.75).length;
  const analyseBlockiert = tragend > 0 && tragend < BELEGE_FUER_ANALYSE;

  return { unsicherheit, analyseBlockiert };
}
