import "server-only";

import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";

/**
 * Was von den Bewertungen nach draussen geht.
 *
 * Jede Abfrage hier liest aus der SICHT `public_reviews`, nie aus der
 * Tabelle. Die Sicht kennt nur freigegebene Zeilen und nur öffentliche
 * Spalten — keine E-Mail-Adresse, keine Moderationsnotiz, keine
 * Nutzerkennung.
 *
 * Der Unterschied zu einer sorgfältigen `WHERE`-Klausel ist der
 * Unterschied zwischen „wir denken daran" und „es geht nicht anders".
 * Wer hier eine Bedingung vergisst, bekommt trotzdem nur, was
 * veröffentlicht werden darf.
 */

export interface OeffentlicheBewertung {
  id: string;
  displayName: string;
  roleOrCompany: string | null;
  rating: number;
  headline: string | null;
  body: string;
  isVerified: boolean;
  helpfulCount: number;
  publishedAt: Date | null;
}

export type Sortierung = "neueste" | "beste" | "hilfreichste";

export interface Kennzahlen {
  /** Der Durchschnitt, oder null wenn es noch keine Bewertung gibt. */
  schnitt: number | null;
  anzahl: number;
  /** Wie viele je Sternestufe — Index 0 ist ein Stern. */
  verteilung: number[];
}

/**
 * Durchschnitt und Verteilung.
 *
 * `schnitt` ist bewusst `null` und nicht `0`, wenn es nichts gibt. Null
 * Sterne wären eine Aussage — und zwar eine sehr schlechte über ein
 * Produkt, das schlicht noch keine Bewertung hat.
 */
export async function kennzahlen(): Promise<Kennzahlen> {
  const db = await getDb();
  const zeilen = await db
    .select({ rating: schema.publicReviews.rating })
    .from(schema.publicReviews)
    .catch(() => []);

  const verteilung = [0, 0, 0, 0, 0];
  for (const z of zeilen) {
    const i = Math.min(5, Math.max(1, z.rating)) - 1;
    verteilung[i] = (verteilung[i] ?? 0) + 1;
  }

  return {
    anzahl: zeilen.length,
    schnitt:
      zeilen.length === 0
        ? null
        : zeilen.reduce((s, z) => s + z.rating, 0) / zeilen.length,
    verteilung,
  };
}

/**
 * Die Bewertungen für die Startseite.
 *
 * Hervorgehobene zuerst, in der vom Team gesetzten Reihenfolge, danach
 * die neuesten. Ohne hervorgehobene ist es einfach die neueste Auswahl —
 * es wird nichts erfunden, um die Fläche zu füllen.
 */
export async function fuerStartseite(anzahl = 6): Promise<OeffentlicheBewertung[]> {
  const db = await getDb();
  return db
    .select()
    .from(schema.publicReviews)
    .orderBy(
      desc(schema.publicReviews.isFeatured),
      asc(schema.publicReviews.sortOrder),
      desc(schema.publicReviews.publishedAt),
    )
    .limit(anzahl)
    .catch(() => []);
}

/** Die Übersichtsseite mit Filter, Sortierung und Blättern. */
export async function alleOeffentlichen(optionen: {
  sterne?: number | null;
  sortierung?: Sortierung;
  seite?: number;
  proSeite?: number;
}): Promise<{ zeilen: OeffentlicheBewertung[]; gesamt: number; seiten: number }> {
  const db = await getDb();
  const proSeite = Math.min(50, Math.max(6, optionen.proSeite ?? 12));
  const filter =
    optionen.sterne && optionen.sterne >= 1 && optionen.sterne <= 5
      ? eq(schema.publicReviews.rating, optionen.sterne)
      : undefined;

  const [gezaehlt] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.publicReviews)
    .where(filter)
    .catch(() => [{ n: 0 }]);

  const gesamt = gezaehlt?.n ?? 0;
  const seiten = Math.max(1, Math.ceil(gesamt / proSeite));
  /*
   * Die Seitenzahl wird eingefangen, nicht angenommen.
   *
   * `?seite=99` bei drei Seiten ergäbe sonst eine leere Liste — und
   * eine leere Liste sieht aus wie „es gibt keine Bewertungen", nicht
   * wie „diese Seite gibt es nicht".
   */
  const seite = Math.min(seiten, Math.max(1, optionen.seite ?? 1));

  const reihenfolge =
    optionen.sortierung === "beste"
      ? [desc(schema.publicReviews.rating), desc(schema.publicReviews.publishedAt)]
      : optionen.sortierung === "hilfreichste"
        ? [desc(schema.publicReviews.helpfulCount), desc(schema.publicReviews.publishedAt)]
        : [desc(schema.publicReviews.publishedAt)];

  const zeilen = await db
    .select()
    .from(schema.publicReviews)
    .where(filter)
    .orderBy(...reihenfolge)
    .limit(proSeite)
    .offset((seite - 1) * proSeite)
    .catch(() => []);

  return { zeilen, gesamt, seiten };
}

/** Wie viele noch auf Moderation warten. Für die Betriebsseite. */
export async function offeneModerationen(): Promise<number> {
  const db = await getDb();
  const [zeile] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.platformReviews)
    .where(eq(schema.platformReviews.status, "pending"))
    .catch(() => [{ n: 0 }]);
  return zeile?.n ?? 0;
}

/** Nur zur Sicherheit im Test verwendet: gab es diese Woche Zulauf? */
export async function neueSeit(seit: Date): Promise<number> {
  const db = await getDb();
  const [zeile] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.platformReviews)
    .where(and(gte(schema.platformReviews.createdAt, seit)))
    .catch(() => [{ n: 0 }]);
  return zeile?.n ?? 0;
}
