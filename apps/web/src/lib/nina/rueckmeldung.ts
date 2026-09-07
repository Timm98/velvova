import "server-only";

import { and, desc, eq, isNotNull} from "drizzle-orm";
import { getDb, schema, withUser , type Database } from "@paycheck/db";
import { ereignisSchreiben } from "./ereignisse";
import { musterErkennen } from "./musterregeln";

/**
 * Rückmeldungen zu Vorschlägen — und was Monday daraus schliessen darf.
 *
 * ── Die Reihenfolge ist die Aussage ───────────────────────────
 *
 *   1. Die Rückmeldung wird gespeichert. Immer, unverändert.
 *   2. Danach wird geprüft, ob ein Muster entstanden ist.
 *   3. Aus dem Muster wird ein EREIGNIS mit einer Frage.
 *
 * Was hier nicht passiert: eine Präferenz setzen. Zwischen Schritt 3
 * und einer Regel steht eine Antwort eines Menschen, und die holt das
 * Gespräch ein, nicht diese Datei.
 */

export type Rueckmeldungsart = "interessiert" | "abgelehnt" | "spaeter" | "beworben";

export async function rueckmeldungSchreiben(
  userId: string,
  eingabe: {
    matchId?: string | null;
    jobId?: string | null;
    art: Rueckmeldungsart;
    grund?: string | null;
    freitext?: string | null;
  },
): Promise<{ muster: ReturnType<typeof musterErkennen> }> {
  const db = await getDb();

  await withUser(db, userId, (tx) =>
    tx.insert(schema.matchFeedback).values({
      userId,
      matchId: eingabe.matchId ?? null,
      jobId: eingabe.jobId ?? null,
      art: eingabe.art,
      grund: eingabe.grund ?? null,
      freitext: eingabe.freitext?.slice(0, 2000) ?? null,
    }),
  );

  /*
   * Muster nur aus Ablehnungen.
   *
   * „Beworben" und „interessiert" sagen nichts darüber, was jemand
   * NICHT will — und genau das ist die Frage, um die es geht.
   */
  if (eingabe.art !== "abgelehnt") return { muster: null };

  const letzte = await withUser(db, userId, (tx) =>
    tx
      .select({
        grund: schema.matchFeedback.grund,
        erstelltAm: schema.matchFeedback.erstelltAm,
      })
      .from(schema.matchFeedback)
      .where(
        and(eq(schema.matchFeedback.userId, userId), eq(schema.matchFeedback.art, "abgelehnt")),
      )
      .orderBy(desc(schema.matchFeedback.erstelltAm))
      /*
       * Nur die jüngsten zwanzig.
       *
       * Wer vor einem Jahr Vertrieb abgelehnt hat, muss sich das nicht
       * ewig anrechnen lassen. Ein Fenster hält das Muster an dem, was
       * jemand GERADE sucht — Menschen ändern ihre Richtung, und ein
       * Gedächtnis ohne Fenster hält sie an der alten fest.
       */
      .limit(20),
  );

  const muster = musterErkennen(letzte);
  if (!muster) return { muster: null };

  /*
   * Nicht zweimal dasselbe fragen.
   *
   * Wer die Frage schon einmal bekommen hat, bekommt sie nicht bei
   * jeder weiteren Ablehnung erneut. Der Bezug trägt den Grund, damit
   * sich das prüfen lässt.
   */
  const schonGefragt = await withUser(db, userId, (tx) =>
    tx
      .select({ id: schema.ninaEvents.id })
      .from(schema.ninaEvents)
      .where(
        and(
          eq(schema.ninaEvents.userId, userId),
          eq(schema.ninaEvents.art, "muster_erkannt"),
          eq(schema.ninaEvents.bezugsart, "profil"),
        ),
      ),
  );
  if (schonGefragt.some((e) => e.id)) {
    const offen = await withUser(db, userId, (tx) =>
      tx
        .select({ nutzlast: schema.ninaEvents.nutzlast })
        .from(schema.ninaEvents)
        .where(
          and(eq(schema.ninaEvents.userId, userId), eq(schema.ninaEvents.art, "muster_erkannt")),
        ),
    );
    if (offen.some((e) => (e.nutzlast as { grund?: string }).grund === muster.grund)) {
      return { muster: null };
    }
  }

  await ereignisSchreiben(userId, {
    art: "muster_erkannt",
    titel: muster.frage,
    prioritaet: 3,
    bezugsart: "profil",
    nutzlast: {
      grund: muster.grund,
      treffer: muster.treffer,
      gesamt: muster.gesamt,
      /* Die Frage steht auch in der Nutzlast: Der Titel kann sich mit
         einer neuen Textfassung ändern, die Frage soll dieselbe
         bleiben, solange das Ereignis offen ist. */
      frage: muster.frage,
    },
  });

  return { muster };
}

/**
 * Welche Stellen die Person abgelegt hat.
 *
 * Eine Menge statt einer Liste, weil der Aufrufer genau eine Frage
 * stellt — „ist diese dabei?" — und das für jede Stelle der Rangliste.
 *
 * Nur `abgelehnt`: „später" heisst später, nicht nie. Wer eine Stelle
 * zurückstellt, will sie wiedersehen, und sie hier mitzuzählen wäre
 * die stille Umdeutung einer Vertagung in eine Absage.
 */
export async function abgelegteStellen(userId: string): Promise<Set<string>> {
  const db = await getDb();
  return withUser(db, userId, (tx) => abgelegteStellenAusTx(tx, userId));
}

/**
 * Dieselbe Menge, aber in einer bereits offenen Transaktion.
 *
 * ── Warum das messbar war ────────────────────────────────────
 *
 * Diese eine Abfrage war der gesamte Aufwand von `listJobsForUser`.
 * Gemessen auf der Stellenseite, warmer Server:
 *
 *     scoreAllJobs (600 bewertet)     0 ms   (Zwischenspeicher)
 *     abgelegteStellen              179 ms
 *     fertig                        181 ms
 *
 * Null gegen 179. Die Bewertung von sechshundert Stellen kostet
 * nichts, weil sie zwischengespeichert ist — die eine Abfrage nach
 * abgelegten Stellen kostet vier Netzrunden gegen Supabase, weil sie
 * eine eigene Transaktion aufmacht.
 *
 * Wer schon eine offene hat, ruft diese Fassung auf.
 */
export async function abgelegteStellenAusTx(
  tx: Database,
  userId: string,
): Promise<Set<string>> {
  const zeilen = await tx
    .selectDistinct({ jobId: schema.matchFeedback.jobId })
    .from(schema.matchFeedback)
    .where(
      and(
        eq(schema.matchFeedback.userId, userId),
        eq(schema.matchFeedback.art, "abgelehnt"),
        isNotNull(schema.matchFeedback.jobId),
      ),
    );
  return new Set(zeilen.map((z) => z.jobId).filter((id): id is string => id !== null));
}
