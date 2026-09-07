import "server-only";

import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { entscheide, type Entscheidung, type Fakt, type Faktquelle } from "./faktenregeln";

/**
 * Mondays Gedächtnis lesen und schreiben.
 *
 * ── Warum jeder Schreibvorgang durch `entscheide` geht ────────
 *
 * Es gibt keinen zweiten Weg in diese Tabelle. Ein direktes
 * `insert … on conflict do update` wäre kürzer und würde genau das
 * tun, was die Regel verbietet: einen bestätigten Wert durch eine
 * Vermutung ersetzen.
 *
 * Die Regel steht deshalb nicht als Hinweis in diesem Kommentar,
 * sondern als Funktion, an der jeder Aufruf vorbeimuss.
 */

export type Faktzeile = typeof schema.profileFacts.$inferSelect;

/** Alles, was gerade gilt — Abgelaufenes bleibt draussen. */
export async function faktenLaden(userId: string): Promise<Faktzeile[]> {
  const db = await getDb();
  const jetzt = new Date();
  return withUser(db, userId, (tx) =>
    tx
      .select()
      .from(schema.profileFacts)
      .where(
        and(
          eq(schema.profileFacts.userId, userId),
          /* Ein Fakt ohne Verfallsdatum gilt; einer mit gilt bis
             dahin. „Sucht nicht aktiv" ist im März wahr und im
             Oktober womöglich nicht mehr. */
          or(isNull(schema.profileFacts.gueltigBis), gt(schema.profileFacts.gueltigBis, jetzt)),
        ),
      )
      .orderBy(desc(schema.profileFacts.bestaetigt), desc(schema.profileFacts.aktualisiertAm)),
  );
}

export type Faktwunsch = {
  art: string;
  schluessel: string;
  wert: unknown;
  quelle: Faktquelle;
  konfidenz: number;
  bestaetigt?: boolean;
  beleg?: string | null;
  gueltigBis?: Date | null;
};

export type Schreibergebnis = {
  entscheidung: Entscheidung;
  /** Die Frage, falls eine entstanden ist. */
  frage: string | null;
};

/**
 * Einen Fakt ablegen — nach der Regel, nicht darüber hinweg.
 */
export async function faktSchreiben(
  userId: string,
  wunsch: Faktwunsch,
): Promise<Schreibergebnis> {
  const db = await getDb();
  const bestaetigt = wunsch.bestaetigt ?? wunsch.quelle === "nutzer";

  /* Der bestätigte Stand zählt als das Bestehende. Gibt es keinen,
     der unbestätigte. */
  const vorhanden = await withUser(db, userId, (tx) =>
    tx
      .select()
      .from(schema.profileFacts)
      .where(
        and(
          eq(schema.profileFacts.userId, userId),
          eq(schema.profileFacts.schluessel, wunsch.schluessel),
        ),
      )
      .orderBy(desc(schema.profileFacts.bestaetigt)),
  );

  const alt: Fakt | null = vorhanden[0]
    ? {
        schluessel: vorhanden[0].schluessel,
        wert: vorhanden[0].wert,
        quelle: vorhanden[0].quelle as Faktquelle,
        konfidenz: vorhanden[0].konfidenz,
        bestaetigt: vorhanden[0].bestaetigt,
      }
    : null;

  const entscheidung = entscheide(alt, {
    schluessel: wunsch.schluessel,
    wert: wunsch.wert,
    quelle: wunsch.quelle,
    konfidenz: wunsch.konfidenz,
    bestaetigt,
  });

  if (entscheidung.art === "verwerfen") return { entscheidung, frage: null };

  const jetzt = new Date();
  const zeile = {
    userId,
    art: wunsch.art,
    schluessel: wunsch.schluessel,
    wert: wunsch.wert,
    quelle: wunsch.quelle,
    beleg: wunsch.beleg ?? null,
    konfidenz: Math.max(0, Math.min(100, Math.round(wunsch.konfidenz))),
    /*
     * Beim Nachfragen wird der neue Fakt IMMER unbestätigt abgelegt.
     *
     * Er steht dann neben dem bestätigten — der eindeutige Index läuft
     * über `(user, schluessel, bestaetigt)` und lässt genau diese zwei
     * Zeilen zu. Das ist der ganze Mechanismus: Nichts geht verloren,
     * nichts wird überschrieben, und die Frage hat einen Gegenstand.
     */
    bestaetigt: entscheidung.art === "nachfragen" ? false : bestaetigt,
    bestaetigtAm: entscheidung.art !== "nachfragen" && bestaetigt ? jetzt : null,
    gueltigBis: wunsch.gueltigBis ?? null,
    aktualisiertAm: jetzt,
  };

  await withUser(db, userId, (tx) =>
    tx
      .insert(schema.profileFacts)
      .values(zeile)
      .onConflictDoUpdate({
        target: [
          schema.profileFacts.userId,
          schema.profileFacts.schluessel,
          schema.profileFacts.bestaetigt,
        ],
        set: {
          art: zeile.art,
          wert: zeile.wert,
          quelle: zeile.quelle,
          beleg: zeile.beleg,
          konfidenz: zeile.konfidenz,
          gueltigBis: zeile.gueltigBis,
          aktualisiertAm: jetzt,
        },
      }),
  );

  return {
    entscheidung,
    frage: entscheidung.art === "nachfragen" ? entscheidung.frage : null,
  };
}

/**
 * Einen Vorschlag annehmen — die Antwort auf Mondays Nachfrage.
 *
 * Der unbestätigte Fakt wird zum bestätigten, der alte fällt weg. Erst
 * hier, nach einer ausdrücklichen Antwort, ändert sich die Wahrheit
 * über einen Menschen.
 */
export async function faktBestaetigen(userId: string, schluessel: string): Promise<boolean> {
  const db = await getDb();
  const [vorschlag] = await withUser(db, userId, (tx) =>
    tx
      .select()
      .from(schema.profileFacts)
      .where(
        and(
          eq(schema.profileFacts.userId, userId),
          eq(schema.profileFacts.schluessel, schluessel),
          eq(schema.profileFacts.bestaetigt, false),
        ),
      )
      .limit(1),
  );
  if (!vorschlag) return false;

  const jetzt = new Date();
  await withUser(db, userId, async (tx) => {
    /* Erst der alte weg, dann der neue hoch — umgekehrt verletzte die
       Reihenfolge den eindeutigen Index. */
    await tx
      .delete(schema.profileFacts)
      .where(
        and(
          eq(schema.profileFacts.userId, userId),
          eq(schema.profileFacts.schluessel, schluessel),
          eq(schema.profileFacts.bestaetigt, true),
        ),
      );
    await tx
      .update(schema.profileFacts)
      .set({ bestaetigt: true, bestaetigtAm: jetzt, konfidenz: 100, aktualisiertAm: jetzt })
      .where(eq(schema.profileFacts.id, vorschlag.id));
  });
  return true;
}

/** Einen Vorschlag ablehnen. Der bestätigte Stand bleibt, wie er war. */
export async function faktVerwerfen(userId: string, schluessel: string): Promise<void> {
  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx
      .delete(schema.profileFacts)
      .where(
        and(
          eq(schema.profileFacts.userId, userId),
          eq(schema.profileFacts.schluessel, schluessel),
          eq(schema.profileFacts.bestaetigt, false),
        ),
      ),
  );
}

/** Einen Fakt ganz entfernen — das Recht, vergessen zu werden. */
export async function faktLoeschen(userId: string, schluessel: string): Promise<void> {
  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx
      .delete(schema.profileFacts)
      .where(
        and(
          eq(schema.profileFacts.userId, userId),
          eq(schema.profileFacts.schluessel, schluessel),
        ),
      ),
  );
}
