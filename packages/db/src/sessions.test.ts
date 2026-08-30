import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, type Database } from "./client.ts";
import { runMigrations } from "./migrate.ts";
import { withUser } from "./session.ts";
import * as s from "./schema/index.ts";

/**
 * Welche Sitzungen als „aktiv" gelten.
 *
 * Der Anlass war sichtbar und trotzdem monatelang unbemerkt: die
 * Einstellungsseite war **160.000 Pixel hoch** und listete **2.071
 * angemeldete Geräte**. Zwei Fehler zusammen:
 *
 * Geprüft wurde nur `revokedAt`, nicht das Ablaufdatum. Eine Sitzung,
 * die vor Monaten abgelaufen war, stand weiter unter „aktive Geräte" —
 * das ist keine zu lange Liste, das ist eine falsche Aussage über die
 * Sicherheit des Kontos.
 *
 * Und es gab keine Obergrenze. Jede Anmeldung legt eine Zeile an.
 */

let db: Database;
let close: () => Promise<void>;
let userId: string;

const JETZT = new Date("2026-08-30T12:00:00Z");
const tage = (n: number) => new Date(JETZT.getTime() + n * 86_400_000);

beforeAll(async () => {
  const handle = await createInMemoryDb();
  db = handle.db;
  close = handle.close;
  await runMigrations(db);

  const [u] = await db.insert(s.users).values({ email: "sessions@example.invalid" }).returning();
  userId = u!.id;

  await db.insert(s.sessions).values([
    { userId, tokenHash: "aktiv-1", deviceLabel: "Laptop", expiresAt: tage(20), lastSeenAt: tage(-1) },
    { userId, tokenHash: "aktiv-2", deviceLabel: "Telefon", expiresAt: tage(10), lastSeenAt: tage(-2) },
    { userId, tokenHash: "abgelaufen", deviceLabel: "Altes Tablet", expiresAt: tage(-5), lastSeenAt: tage(-90) },
    { userId, tokenHash: "widerrufen", deviceLabel: "Fremdes Gerät", expiresAt: tage(20), lastSeenAt: tage(-3), revokedAt: tage(-3) },
  ]);
}, 120_000);

afterAll(async () => {
  await close?.();
});

const aktive = () =>
  withUser(db, userId, (tx) =>
    tx
      .select()
      .from(s.sessions)
      .where(
        and(
          eq(s.sessions.userId, userId),
          isNull(s.sessions.revokedAt),
          gt(s.sessions.expiresAt, JETZT),
        ),
      )
      .orderBy(sql`${s.sessions.lastSeenAt} DESC`),
  );

describe("Aktive Sitzungen", () => {
  it("zählt nur, was weder widerrufen noch abgelaufen ist", async () => {
    const rows = await aktive();
    expect(rows.map((r) => r.deviceLabel).sort()).toEqual(["Laptop", "Telefon"]);
  });

  it("führt eine abgelaufene Sitzung nicht als angemeldetes Gerät", async () => {
    // Der eigentliche Fehler. Eine zu lange Liste ist unangenehm; eine
    // Liste, die fremde Geräte als aktiv ausweist, macht der Person
    // grundlos Angst — oder wiegt sie in Sicherheit, wenn sie das
    // richtige Gerät zwischen 2.000 Zeilen nicht findet.
    const rows = await aktive();
    expect(rows.map((r) => r.deviceLabel)).not.toContain("Altes Tablet");
  });

  it("sortiert das zuletzt benutzte Gerät nach oben", async () => {
    const rows = await aktive();
    expect(rows[0]!.deviceLabel).toBe("Laptop");
  });
});
