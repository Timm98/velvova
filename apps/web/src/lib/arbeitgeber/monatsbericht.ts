"use server";

import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import type { Themenveraenderung } from "@paycheck/domain";
import { protokolliere, verlangeRolle } from "./zugang";

/**
 * ══════════════════════════════════════════════════════════════════
 * Der Monatsbericht im Unternehmensbereich
 * ══════════════════════════════════════════════════════════════════
 *
 * Lesen und einschalten. Gerechnet wird er nicht hier, sondern im
 * Zeitplan — `packages/jobs/src/monatsbericht.ts`. Ein Bericht, der
 * beim Seitenaufruf entstünde, hinge davon ab, ob jemand hinsieht.
 */

export interface Aktivierung {
  aktiv: boolean;
  zeitzone: string;
  zustaendig: string | null;
  aktiviertAm: Date | null;
}

export async function aktivierungLesen(orgId: string): Promise<Aktivierung> {
  const { user } = await verlangeRolle(orgId, "viewer");
  const db = await getDb();
  const [z] = await withUser(db, user.id, (tx) =>
    tx
      .select()
      .from(schema.monatsberichtEinstellungen)
      .where(eq(schema.monatsberichtEinstellungen.organizationId, orgId))
      .limit(1),
  );
  return {
    aktiv: z?.aktiv ?? false,
    zeitzone: z?.zeitzone ?? "Europe/Berlin",
    zustaendig: z?.zustaendig ?? null,
    aktiviertAm: z?.aktiviertAm ?? null,
  };
}

/**
 * Ein- oder ausschalten.
 *
 * ── Warum das Ausschalten nichts löscht ─────────────────────────
 *
 * Die Berichte bleiben stehen. Wer den Bericht abbestellt, will keine
 * neue Ansprache — er will nicht seine Historie loswerden. Beides zu
 * vermischen wäre eine Löschung, die niemand beauftragt hat.
 */
export async function aktivierungSetzen(
  orgId: string,
  aktiv: boolean,
  zustaendig: string | null,
): Promise<Aktivierung> {
  const { user } = await verlangeRolle(orgId, "admin");
  const db = await getDb();

  await withUser(db, user.id, (tx) =>
    tx
      .insert(schema.monatsberichtEinstellungen)
      .values({
        organizationId: orgId,
        aktiv,
        zustaendig,
        aktiviertAm: aktiv ? new Date() : null,
        aktiviertVon: aktiv ? user.id : null,
      })
      .onConflictDoUpdate({
        target: schema.monatsberichtEinstellungen.organizationId,
        set: {
          aktiv,
          zustaendig,
          aktiviertAm: aktiv ? new Date() : null,
          aktiviertVon: aktiv ? user.id : null,
          aktualisiertAm: new Date(),
        },
      }),
  );

  await protokolliere(user.id, orgId, aktiv ? "monatsbericht_ein" : "monatsbericht_aus", orgId);
  return await aktivierungLesen(orgId);
}

export interface Berichtszeile {
  id: string;
  berichtsmonat: string;
  zustand: string;
  lage: string;
  grund: string | null;
  fehler: string | null;
  veraenderungen: Themenveraenderung[];
  fertigAm: Date | null;
}

/** Die letzten Berichte, neueste zuerst. */
export async function berichteLesen(orgId: string, grenze = 12): Promise<Berichtszeile[]> {
  const { user } = await verlangeRolle(orgId, "viewer");
  const db = await getDb();
  const zeilen = await withUser(db, user.id, (tx) =>
    tx
      .select({
        id: schema.monatsberichte.id,
        berichtsmonat: schema.monatsberichte.berichtsmonat,
        zustand: schema.monatsberichte.zustand,
        lage: schema.monatsberichte.lage,
        grund: schema.monatsberichte.grund,
        fehler: schema.monatsberichte.fehler,
        veraenderungen: schema.monatsberichte.veraenderungen,
        fertigAm: schema.monatsberichte.fertigAm,
      })
      .from(schema.monatsberichte)
      .where(
        sql`${schema.monatsberichte.organizationId} = ${orgId} and ${schema.monatsberichte.art} = 'monatslauf'`,
      )
      .orderBy(desc(schema.monatsberichte.berichtsmonat))
      .limit(grenze),
  );

  return zeilen.map((z) => ({
    ...z,
    veraenderungen: (z.veraenderungen ?? []) as Themenveraenderung[],
  }));
}
