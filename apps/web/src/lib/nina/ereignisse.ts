import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";

/**
 * Ereignisse erzeugen und lesen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das Erzeugen so schmal ist
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Ereignis ist eine Feststellung, keine Nachricht. Es enthält,
 * was sich verändert hat, und die Zahlen dazu — mehr nicht. Ob daraus
 * eine Meldung wird, wann sie kommt und wie sie klingt, entscheidet
 * später das Briefing anhand von Priorität, Ruhezeiten und den
 * Einstellungen des Menschen.
 *
 * Wer hier schon einen fertigen Satz schreiben wollte, müsste beim
 * Erzeugen wissen, ob gemeldet wird — und das weiss er nicht.
 */

export type Ereignisart =
  | "neuer_match"
  | "match_verbessert"
  | "stelle_geaendert"
  | "frist_naht"
  | "angabe_fehlt"
  | "muster_erkannt"
  | "nachfassen_faellig";

/** 1 kritisch, 2 wichtig, 3 interessant. */
export type Prioritaet = 1 | 2 | 3;

export type Ereigniswunsch = {
  art: Ereignisart;
  titel: string;
  prioritaet?: Prioritaet;
  bezugsart?: "job" | "match" | "application" | "profil";
  bezugId?: string | null;
  nutzlast?: Record<string, unknown>;
};

export async function ereignisSchreiben(
  userId: string,
  wunsch: Ereigniswunsch,
): Promise<void> {
  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx.insert(schema.ninaEvents).values({
      userId,
      art: wunsch.art,
      titel: wunsch.titel.slice(0, 300),
      prioritaet: wunsch.prioritaet ?? 3,
      bezugsart: wunsch.bezugsart ?? null,
      bezugId: wunsch.bezugId ?? null,
      nutzlast: wunsch.nutzlast ?? {},
    }),
  );
}

/**
 * Was noch nicht verarbeitet wurde — für das Briefing.
 *
 * Nach Priorität, dann nach Alter: Ein kritisches Ereignis von gestern
 * geht einem interessanten von heute vor.
 */
export async function offeneEreignisse(userId: string, grenze = 50) {
  const db = await getDb();
  return withUser(db, userId, (tx) =>
    tx
      .select()
      .from(schema.ninaEvents)
      .where(and(eq(schema.ninaEvents.userId, userId), isNull(schema.ninaEvents.verarbeitetAm)))
      .orderBy(schema.ninaEvents.prioritaet, desc(schema.ninaEvents.erstelltAm))
      .limit(grenze),
  );
}

/**
 * Als verarbeitet markieren.
 *
 * Getrennt vom Zeigen: Ein Ereignis kann verarbeitet und trotzdem nie
 * gezeigt werden — etwa wenn zehn stärkere daneben standen. Beides in
 * einem Feld liesse sich später nicht mehr auseinanderhalten, und die
 * Frage „warum habe ich das nie gesehen" wäre unbeantwortbar.
 */
export async function ereignisseVerarbeitet(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const { inArray } = await import("drizzle-orm");
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.ninaEvents)
      .set({ verarbeitetAm: new Date() })
      .where(and(eq(schema.ninaEvents.userId, userId), inArray(schema.ninaEvents.id, ids))),
  );
}

export async function ereignisGezeigt(userId: string, id: string): Promise<void> {
  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.ninaEvents)
      .set({ gezeigtAm: new Date() })
      .where(and(eq(schema.ninaEvents.userId, userId), eq(schema.ninaEvents.id, id))),
  );
}

/**
 * Der Vergleich zweier Matchstände — Fall E aus der Vorgabe.
 *
 * Rein rechnerisch und ohne Datenbank, damit die Schwelle prüfbar
 * bleibt: Ab wann ist eine Verbesserung eine Meldung wert?
 *
 * Fünf Punkte. Darunter ist es Rauschen — ein Match schwankt bei
 * jeder Neuberechnung um ein, zwei Punkte, weil sich Datenlage und
 * Bestand ändern. Wer bei jedem Punkt meldet, meldet täglich, und
 * dann liest niemand mehr.
 */
export const MELDESCHWELLE = 5;

export function verbesserung(vorher: number, nachher: number, faktoren: string[]) {
  const differenz = nachher - vorher;
  if (differenz < MELDESCHWELLE) return null;
  return {
    art: "match_verbessert" as const,
    /* Ein Sprung über zwanzig Punkte ist etwas anderes als einer über
       sechs — er bedeutet meistens, dass eine harte Bedingung jetzt
       erfüllt ist. */
    prioritaet: (differenz >= 20 ? 1 : 2) as Prioritaet,
    nutzlast: { vorher, nachher, differenz, faktoren },
  };
}
