"use server";

import { getDb, schema, withSystem, withUser } from "@paycheck/db";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { Erfahrungsebene } from "@paycheck/domain";

/**
 * Reality Sessions — die konkrete Stelle erleben.
 *
 * ── Warum die kleine Fassung zuerst ───────────────────────────
 *
 * Ein halber Tag im Team, mit Aufgabe und Rückmeldung vom künftigen
 * Vorgesetzten, braucht Arbeitgeber, die mitmachen. Die kleine Fassung
 * braucht nur einen Menschen, der die Rolle kennt: fünfzehn Minuten,
 * anonym, mit jemandem, der dort arbeitet oder gearbeitet hat.
 *
 * Wer mit der grossen anfinge, hätte auf Monate nichts.
 *
 * ── Was hier ausdrücklich nicht passiert ──────────────────────
 *
 * Keine Vermittlung von unbezahlter Arbeit. Eine Aufgabe ohne
 * Vergütung muss in einer Testumgebung stattfinden — `verguetet`
 * hält fest, was gilt, und die Oberfläche sagt es dazu.
 */

export interface Realitaetsangebot {
  id: string;
  art: string;
  beschreibung: string;
  dauerMinuten: number;
  verguetet: boolean;
}

/** Was zu dieser Stelle angeboten wird. */
export async function angeboteFuerStelle(jobId: string): Promise<Realitaetsangebot[]> {
  const db = await getDb();
  return await withSystem(db, (tx) =>
    tx
      .select({
        id: schema.realitaetsproben.id,
        art: schema.realitaetsproben.art,
        beschreibung: schema.realitaetsproben.beschreibung,
        dauerMinuten: schema.realitaetsproben.dauerMinuten,
        verguetet: schema.realitaetsproben.verguetet,
      })
      .from(schema.realitaetsproben)
      .where(and(eq(schema.realitaetsproben.jobId, jobId), eq(schema.realitaetsproben.aktiv, true))),
  ).catch(() => []);
}

/**
 * Ein Gespräch anbieten — als jemand, der die Rolle kennt.
 *
 * Ohne Prüfung, ob die Person dort wirklich arbeitet: Diese Prüfung
 * gäbe es nur über den Arbeitgeber, und dann wäre es kein
 * unabhängiges Gespräch mehr. Statt dessen zählt die Rückmeldung
 * derer, die es geführt haben.
 */
export async function gespraechAnbieten(
  jobId: string,
  beschreibung: string,
  dauerMinuten = 15,
): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx.insert(schema.realitaetsproben).values({
      jobId,
      art: "gespraech",
      anbieterUserId: user.id,
      beschreibung: beschreibung.trim().slice(0, 2000),
      dauerMinuten: Math.min(180, Math.max(5, Math.round(dauerMinuten))),
      verguetet: false,
    }),
  );
  revalidatePath(`/app/jobs/${jobId}`);
}

export interface Realitaetseingabe {
  probeId: string;
  klarheit: number | null;
  rueckmeldung: number | null;
  respekt: number | null;
  tempo: number | null;
  stimmtMitAnzeige: number | null;
  energie: number | null;
  notiz?: string;
}

/** Die eigene Rückmeldung nach einer Session. */
export async function rueckmeldungAbgeben(e: Realitaetseingabe): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  const w = (v: number | null) => (v === null ? null : Math.min(5, Math.max(1, Math.round(v))));
  await withUser(db, user.id, (tx) =>
    tx
      .insert(schema.realitaetsrueckmeldungen)
      .values({
        probeId: e.probeId,
        userId: user.id,
        klarheit: w(e.klarheit),
        rueckmeldung: w(e.rueckmeldung),
        respekt: w(e.respekt),
        tempo: w(e.tempo),
        stimmtMitAnzeige: w(e.stimmtMitAnzeige),
        energie: w(e.energie),
        notiz: (e.notiz ?? "").slice(0, 4000),
      })
      .onConflictDoUpdate({
        target: [schema.realitaetsrueckmeldungen.probeId, schema.realitaetsrueckmeldungen.userId],
        set: {
          klarheit: w(e.klarheit),
          rueckmeldung: w(e.rueckmeldung),
          respekt: w(e.respekt),
          tempo: w(e.tempo),
          stimmtMitAnzeige: w(e.stimmtMitAnzeige),
          energie: w(e.energie),
          notiz: (e.notiz ?? "").slice(0, 4000),
        },
      }),
  );
}

/** Ab wann Rückmeldungen als Mittelwert erscheinen dürfen. */
const MIN_RUECKMELDUNGEN = 4;

export interface Realitaetsbild {
  anzahl: number;
  /** Woher die Zahlen stammen. Gehört an jede Anzeige. */
  ebene: Erfahrungsebene;
  klarheit: number | null;
  rueckmeldung: number | null;
  respekt: number | null;
  tempo: number | null;
  stimmtMitAnzeige: number | null;
}

/**
 * Was Menschen nach einer Session über diese Stelle gesagt haben.
 *
 * `null` unter vier Rückmeldungen — bei dreien liesse sich aus einem
 * Mittelwert auf eine einzelne Person schliessen, und die hat anonym
 * geantwortet.
 */
/**
 * Das Erfahrungsbild zu einer Stelle — mit Rückfall auf breitere Ebenen.
 *
 * ── Warum drei Ebenen ─────────────────────────────────────────
 *
 * Zu einer einzelnen Anzeige gibt es fast nie vier Rückmeldungen. Die
 * strenge Grenze war richtig — aus dreien liesse sich auf eine
 * einzelne Person schliessen — führte aber dazu, dass praktisch immer
 * nichts dastand, obwohl über den Beruf durchaus etwas bekannt ist.
 *
 * Also: erst die Stelle, dann derselbe Beruf bei demselben
 * Arbeitgeber, dann die Berufsgruppe. Die erste Ebene mit genug
 * Rückmeldungen gewinnt, und die Oberfläche sagt, welche es war.
 *
 * Was NICHT passiert: Ebenen mischen. Zwei Rückmeldungen zur Stelle
 * plus zwei zum Beruf sind keine vier zur Stelle.
 */
export async function realitaetsbild(
  jobId: string,
  bezug: { companyId?: string | null; kldb?: string | null } = {},
): Promise<Realitaetsbild> {
  const db = await getDb();

  const messen = async (bedingung: ReturnType<typeof eq> | undefined) => {
    if (!bedingung) return null;
    const [r] = await withSystem(db, (tx) =>
      tx
        .select({
          anzahl: sql<number>`count(*)::int`,
          klarheit: sql<number | null>`avg(${schema.realitaetsrueckmeldungen.klarheit})`,
          rueckmeldung: sql<number | null>`avg(${schema.realitaetsrueckmeldungen.rueckmeldung})`,
          respekt: sql<number | null>`avg(${schema.realitaetsrueckmeldungen.respekt})`,
          tempo: sql<number | null>`avg(${schema.realitaetsrueckmeldungen.tempo})`,
          stimmtMitAnzeige: sql<number | null>`avg(${schema.realitaetsrueckmeldungen.stimmtMitAnzeige})`,
        })
        .from(schema.realitaetsrueckmeldungen)
        .innerJoin(
          schema.realitaetsproben,
          eq(schema.realitaetsproben.id, schema.realitaetsrueckmeldungen.probeId),
        )
        .innerJoin(schema.jobs, eq(schema.jobs.id, schema.realitaetsproben.jobId))
        .where(bedingung),
    ).catch(() => []);
    return r ?? null;
  };

  const gruppe = bezug.kldb ? String(bezug.kldb).slice(0, 2) : null;
  const stufen: [Erfahrungsebene, ReturnType<typeof eq> | undefined][] = [
    ["stelle", eq(schema.realitaetsproben.jobId, jobId)],
    [
      "arbeitgeber",
      bezug.companyId && gruppe
        ? and(
            eq(schema.jobs.companyId, bezug.companyId),
            sql`left(${schema.jobs.kldb}, 2) = ${gruppe}`,
          )
        : undefined,
    ],
    ["beruf", gruppe ? sql`left(${schema.jobs.kldb}, 2) = ${gruppe}` : undefined],
  ];

  for (const [ebene, bedingung] of stufen) {
    const r = await messen(bedingung);
    const n = Number(r?.anzahl ?? 0);
    if (n < MIN_RUECKMELDUNGEN) continue;
    const z = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    return {
      anzahl: n,
      ebene,
      klarheit: z(r?.klarheit),
      rueckmeldung: z(r?.rueckmeldung),
      respekt: z(r?.respekt),
      tempo: z(r?.tempo),
      stimmtMitAnzeige: z(r?.stimmtMitAnzeige),
    };
  }

  /*
   * Keine Ebene hat genug — dann zählt nur, wie viele es zur Stelle
   * sind. Die Zahl steht da, die Mittelwerte nicht: Aus dreien liesse
   * sich auf eine einzelne Person schliessen, und die hat anonym
   * geantwortet.
   */
  const nurStelle = await messen(eq(schema.realitaetsproben.jobId, jobId));
  return {
    anzahl: Number(nurStelle?.anzahl ?? 0),
    ebene: "stelle",
    klarheit: null,
    rueckmeldung: null,
    respekt: null,
    tempo: null,
    stimmtMitAnzeige: null,
  };
}
