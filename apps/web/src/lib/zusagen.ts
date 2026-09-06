"use server";

import { getDb, schema, withSystem, withUser } from "@paycheck/db";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  jobcheck,
  promiseKept,
  PUNKTTEXT,
  widersprueche,
  type Jobcheck,
  ZUSAGEPUNKTE,
  type PromiseKept,
  type Zusagenherkunft,
  type Zusagenpruefung,
  type Zusagenstand,
  type Zusagepunkt,
} from "@paycheck/domain";
import { requireUser } from "@/lib/auth";

/**
 * Der Promise Lock.
 *
 * ── Was er misst, und was der Outcome Loop misst ──────────────
 *
 * Der Outcome Loop fragt: Stimmte UNSERE Vorhersage? Das ist eine
 * Frage über uns.
 *
 * Der Promise Lock fragt: Hielt der ARBEITGEBER, was er zugesagt hat?
 * Das ist eine Frage über ihn — und sie beantwortet, was keine
 * Sternebewertung beantwortet.
 *
 * Beide sind nötig, und beide messen etwas anderes. Ein Arbeitgeber
 * kann Wort halten, und die Stelle passt trotzdem nicht; und eine gut
 * passende Stelle kann bei einem Arbeitgeber liegen, der nichts
 * einhält.
 */

export interface Zusageneingabe {
  applicationId: string;
  punkt: Zusagepunkt;
  zusage: string;
  herkunft: Zusagenherkunft;
  beleg?: string;
}

async function eigeneBewerbung(userId: string, applicationId: string) {
  const db = await getDb();
  const [b] = await withUser(db, userId, (tx) =>
    tx
      .select({ id: schema.applications.id, jobId: schema.applications.jobId })
      .from(schema.applications)
      .where(and(eq(schema.applications.id, applicationId), eq(schema.applications.userId, userId)))
      .limit(1),
  );
  return b ?? null;
}

/**
 * Eine Zusage festhalten — vor der Unterschrift.
 *
 * Danach ginge es auch, aber dann schreibt die Erinnerung mit. Der
 * Wert dieser Tabelle hängt daran, dass die Zusage notiert wird, solange
 * sie frisch ist.
 */
export async function zusageFesthalten(e: Zusageneingabe): Promise<void> {
  const user = await requireUser();
  if (!ZUSAGEPUNKTE.includes(e.punkt)) throw new Error("Diesen Punkt gibt es nicht.");
  const bewerbung = await eigeneBewerbung(user.id, e.applicationId);
  if (!bewerbung) throw new Error("Diese Bewerbung gibt es nicht.");

  const text = e.zusage.trim();
  if (text.length < 3) throw new Error("Schreib kurz, was zugesagt wurde.");

  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx.insert(schema.zusagen).values({
      userId: user.id,
      applicationId: bewerbung.id,
      punkt: e.punkt,
      zusage: text.slice(0, 1000),
      herkunft: e.herkunft,
      beleg: (e.beleg ?? "").trim().slice(0, 1000),
    }),
  );
  revalidatePath("/app/zusagen");
}

/** Eine Zusage prüfen — zu einer der Marken 14, 30, 90. */
export async function zusagePruefen(
  zusageId: string,
  tagesmarke: number,
  stand: Zusagenstand,
  notiz = "",
): Promise<void> {
  const user = await requireUser();
  const marke = [14, 30, 90].includes(tagesmarke) ? tagesmarke : 30;
  const db = await getDb();

  /*
   * Prüfen statt vertrauen: Die Kennung kommt aus dem Formular.
   * Die Zeilensicherheit fängt Fremdzugriffe ab, aber ein sprechender
   * Fehler ist besser als eine stillschweigend wirkungslose Anweisung.
   */
  const [z] = await withUser(db, user.id, (tx) =>
    tx
      .select({ id: schema.zusagen.id })
      .from(schema.zusagen)
      .where(and(eq(schema.zusagen.id, zusageId), eq(schema.zusagen.userId, user.id)))
      .limit(1),
  );
  if (!z) throw new Error("Diese Zusage gibt es nicht.");

  await withUser(db, user.id, (tx) =>
    tx
      .insert(schema.zusagenPruefungen)
      .values({ zusageId, userId: user.id, tagesmarke: marke, stand, notiz: notiz.slice(0, 2000) })
      .onConflictDoUpdate({
        target: [schema.zusagenPruefungen.zusageId, schema.zusagenPruefungen.tagesmarke],
        set: { stand, notiz: notiz.slice(0, 2000), erstelltAm: new Date() },
      }),
  );
  revalidatePath("/app/zusagen");
}

/**
 * Der Job-Check zu einer Bewerbung.
 *
 * Die vier Kästen entstehen aus drei Quellen, die es längst gibt: dem
 * Passungsbefund, der Bedingungsprüfung und den festgehaltenen
 * Zusagen. Nur der vierte — widersprüchlich — brauchte etwas Neues,
 * und auch das keine Textanalyse: Zwei Zusagen zum selben Punkt aus
 * verschiedenen Quellen widersprechen sich oder nicht.
 */
export async function jobcheckFuer(applicationId: string): Promise<{
  befund: Jobcheck;
  fragen: string[];
} | null> {
  const user = await requireUser();
  const bewerbung = await eigeneBewerbung(user.id, applicationId);
  if (!bewerbung) return null;

  const zeilen = await zusagenLaden(applicationId);
  const konflikte = widersprueche(
    zeilen.map((z) => ({ punkt: z.punkt, zusage: z.zusage, herkunft: z.herkunft, beleg: z.beleg })),
  );

  /*
   * Was noch nicht festgehalten wurde, ist ungeklärt.
   *
   * Nicht alle zwölf Punkte: Wer nichts eingetragen hat, bekäme sonst
   * eine Liste von zwölf offenen Fragen und läse keine davon. Die
   * sechs, die im Bewerbungsprozess am häufigsten auseinandergehen.
   */
  const WICHTIG: Zusagepunkt[] = [
    "aufgaben", "arbeitszeit", "homeoffice", "einarbeitung", "ziele_90", "entscheidungsfreiheit",
  ];
  const ungeklaert = WICHTIG.filter((p) => !zeilen.some((z) => z.punkt === p)).map(
    (p) => PUNKTTEXT[p].titel,
  );

  const befund = jobcheck({
    passt: zeilen
      .filter((z) => z.herkunft === "arbeitgeber_bestaetigt" || z.herkunft === "vertrag")
      .map((z) => `${PUNKTTEXT[z.punkt].titel}: ${z.zusage}`),
    passtNicht: [],
    ungeklaert,
    widersprueche: konflikte,
    bedingungGebrochen: false,
  });

  /*
   * Fragen fürs Gespräch: erst die Widersprüche, dann das Offene.
   *
   * Ein Widerspruch ist die dringendere Frage — er bedeutet, dass eine
   * Aussage nicht stimmt.
   */
  const fragen = [
    ...konflikte.map(
      (w) =>
        `Zu ${w.titel}: Es hiess einmal „${w.schwaecher.zusage}" und einmal „${w.staerker.zusage}". Was gilt?`,
    ),
    ...ungeklaert.map((t) => `Wie ist es bei „${t}" geregelt?`),
  ].slice(0, 5);

  return { befund, fragen };
}

export interface ZusageZeile {
  id: string;
  punkt: Zusagepunkt;
  zusage: string;
  herkunft: Zusagenherkunft;
  beleg: string;
  /** Was bei den drei Marken herauskam. */
  stand: Partial<Record<number, Zusagenstand>>;
}

/** Die eigenen Zusagen zu einer Bewerbung, mitsamt Prüfstand. */
export async function zusagenLaden(applicationId: string): Promise<ZusageZeile[]> {
  const user = await requireUser();
  const db = await getDb();
  const zeilen = await withUser(db, user.id, (tx) =>
    tx
      .select({
        id: schema.zusagen.id,
        punkt: schema.zusagen.punkt,
        zusage: schema.zusagen.zusage,
        herkunft: schema.zusagen.herkunft,
        beleg: schema.zusagen.beleg,
        marke: schema.zusagenPruefungen.tagesmarke,
        stand: schema.zusagenPruefungen.stand,
      })
      .from(schema.zusagen)
      .leftJoin(schema.zusagenPruefungen, eq(schema.zusagenPruefungen.zusageId, schema.zusagen.id))
      .where(
        and(eq(schema.zusagen.userId, user.id), eq(schema.zusagen.applicationId, applicationId)),
      ),
  ).catch(() => []);

  const nach = new Map<string, ZusageZeile>();
  for (const z of zeilen) {
    const vorhanden = nach.get(z.id) ?? {
      id: z.id,
      punkt: z.punkt as Zusagepunkt,
      zusage: z.zusage,
      herkunft: z.herkunft as Zusagenherkunft,
      beleg: z.beleg,
      stand: {},
    };
    if (z.marke !== null && z.stand !== null) vorhanden.stand[z.marke] = z.stand as Zusagenstand;
    nach.set(z.id, vorhanden);
  }
  return [...nach.values()];
}

/**
 * Der Promise-Kept-Score eines Arbeitgebers.
 *
 * ── Warum über die Systemverbindung ───────────────────────────
 *
 * Der Score fasst zusammen, was viele Menschen berichtet haben. Keine
 * einzelne Zeile verlässt diese Funktion, und unter
 * `MIN_ZUSAGEN_FUER_QUOTE` beurteilten Zusagen gibt es keine Quote —
 * sonst liesse sich aus ihr auf eine einzelne Person schliessen.
 */
export async function promiseKeptFuerFirma(companyId: string): Promise<PromiseKept> {
  const db = await getDb();
  const zeilen = await withSystem(db, (tx) =>
    tx
      .select({
        punkt: schema.zusagen.punkt,
        herkunft: schema.zusagen.herkunft,
        stand: schema.zusagenPruefungen.stand,
      })
      .from(schema.zusagenPruefungen)
      .innerJoin(schema.zusagen, eq(schema.zusagen.id, schema.zusagenPruefungen.zusageId))
      .innerJoin(schema.applications, eq(schema.applications.id, schema.zusagen.applicationId))
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
      .where(
        and(
          eq(schema.jobs.companyId, companyId),
          /* Die späteste Marke je Zusage zählt — nach 90 Tagen weiss
             man mehr als nach vierzehn. */
          sql`${schema.zusagenPruefungen.tagesmarke} = (
            select max(p2.tagesmarke) from zusagen_pruefungen p2
            where p2.zusage_id = ${schema.zusagenPruefungen.zusageId}
          )`,
        ),
      ),
  ).catch(() => []);

  return promiseKept(
    zeilen.map((z) => ({
      punkt: z.punkt as Zusagepunkt,
      herkunft: z.herkunft as Zusagenherkunft,
      stand: z.stand as Zusagenstand,
    })) as Zusagenpruefung[],
  );
}

/*
 * `MIN_ZUSAGEN_FUER_QUOTE` wird hier NICHT weitergereicht.
 *
 * Diese Datei trägt `"use server"`, und dort muss jeder Export eine
 * asynchrone Server Action sein — eine Konstante daneben bricht den
 * Build. Weder der Typprüfer noch die Unit-Tests sehen das; gefunden
 * hat es `use-server.test.ts`, der genau danach sucht.
 *
 * Wer die Schwelle braucht, holt sie aus `@paycheck/domain`, wo sie
 * ohnehin steht.
 */
