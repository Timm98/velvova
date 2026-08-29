import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, type Database } from "./client.ts";
import { runMigrations } from "./migrate.ts";
import { withUser } from "./session.ts";
import * as s from "./schema/index.ts";

/**
 * Aendern unter der eingeschraenkten Rolle.
 *
 * db.test.ts prueft Lesen, Schreiben und Loeschen. Das Aendern fehlte -
 * und genau daran ist im Produkt die Ablehnung einer Vermutung
 * gescheitert.
 */

let db: Database;
let close: () => Promise<void>;
let userId: string;
let evidenceId: string;

beforeAll(async () => {
  const h = await createInMemoryDb();
  db = h.db;
  close = h.close;
  await runMigrations(db);
  const [u] = await db.insert(s.users).values({ email: "u@example.invalid" }).returning();
  userId = u!.id;
  const [e] = await withUser(db, userId, (tx) =>
    tx
      .insert(s.evidenceItems)
      .values({
        userId,
        type: "skill",
        statement: "Eine Vermutung",
        sourceType: "ai_hypothesis",
        confidence: 0.5,
        userConfirmed: false,
      })
      .returning(),
  );
  evidenceId = e!.id;
}, 120_000);

afterAll(async () => {
  await close?.();
});

describe("Aendern unter der Anwendungsrolle", () => {
  it("setzt userRejected und macht es sichtbar", async () => {
    await withUser(db, userId, (tx) =>
      tx
        .update(s.evidenceItems)
        .set({ userRejected: true, userConfirmed: false, updatedAt: new Date() })
        .where(and(eq(s.evidenceItems.id, evidenceId), eq(s.evidenceItems.userId, userId))),
    );

    const rows = await withUser(db, userId, (tx) =>
      tx.select().from(s.evidenceItems).where(eq(s.evidenceItems.id, evidenceId)),
    );
    expect(rows[0]!.userRejected).toBe(true);
  });

  it("setzt eine Bestaetigung", async () => {
    await withUser(db, userId, (tx) =>
      tx
        .update(s.evidenceItems)
        .set({ userConfirmed: true, userRejected: false })
        .where(eq(s.evidenceItems.id, evidenceId)),
    );
    const rows = await withUser(db, userId, (tx) =>
      tx.select().from(s.evidenceItems).where(eq(s.evidenceItems.id, evidenceId)),
    );
    expect(rows[0]!.userConfirmed).toBe(true);
    expect(rows[0]!.userRejected).toBe(false);
  });

  it("markiert einen Beleg als geloescht", async () => {
    await withUser(db, userId, (tx) =>
      tx.update(s.evidenceItems).set({ deletedAt: new Date() }).where(eq(s.evidenceItems.id, evidenceId)),
    );
    const rows = await withUser(db, userId, (tx) =>
      tx.select().from(s.evidenceItems).where(eq(s.evidenceItems.id, evidenceId)),
    );
    expect(rows[0]!.deletedAt).not.toBeNull();
  });
});
