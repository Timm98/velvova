import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, type Database } from "./client.ts";
import { runMigrations } from "./migrate.ts";
import { withUser } from "./session.ts";
import * as s from "./schema/index.ts";

/**
 * Row Level Security ist eine Sicherheitsbehauptung. Behauptungen dieser
 * Art gehoeren getestet, nicht dokumentiert: hier laeuft echtes Postgres
 * (PGlite), es werden zwei Nutzer angelegt, und es wird geprueft, dass
 * keiner die Daten des anderen sieht.
 *
 * Der erste Anlauf dieses Tests ist fehlgeschlagen, und zwar zu Recht:
 * eine Verbindung als Superuser umgeht RLS vollstaendig. Erst die eigene,
 * eingeschraenkte Anwendungsrolle macht die Richtlinien wirksam.
 */

let db: Database;
let close: () => Promise<void>;
let userA: string;
let userB: string;

beforeAll(async () => {
  const handle = await createInMemoryDb();
  db = handle.db;
  close = handle.close;
  await runMigrations(db);

  // Anlage der Testnutzer bewusst mit erhoehten Rechten, ausserhalb von withUser.
  const [a] = await db.insert(s.users).values({ email: "a@example.invalid" }).returning();
  const [b] = await db.insert(s.users).values({ email: "b@example.invalid" }).returning();
  userA = a!.id;
  userB = b!.id;
}, 120_000);

afterAll(async () => {
  await close?.();
});

describe("Row Level Security", () => {
  it("laesst jeden nur die eigene Evidenz sehen", async () => {
    await withUser(db, userA, (tx) =>
      tx.insert(s.evidenceItems).values({
        userId: userA, type: "skill", statement: "Geheimnis von A",
        sourceType: "user_stated", confidence: 0.9, userConfirmed: true,
      }),
    );
    await withUser(db, userB, (tx) =>
      tx.insert(s.evidenceItems).values({
        userId: userB, type: "skill", statement: "Geheimnis von B",
        sourceType: "user_stated", confidence: 0.9, userConfirmed: true,
      }),
    );

    const seenByA = await withUser(db, userA, (tx) => tx.select().from(s.evidenceItems));
    const seenByB = await withUser(db, userB, (tx) => tx.select().from(s.evidenceItems));

    expect(seenByA).toHaveLength(1);
    expect(seenByA[0]!.statement).toBe("Geheimnis von A");
    expect(seenByB).toHaveLength(1);
    expect(seenByB[0]!.statement).toBe("Geheimnis von B");
  });

  it("verhindert das Schreiben unter fremder Kennung", async () => {
    await expect(
      withUser(db, userB, (tx) =>
        tx.insert(s.evidenceItems).values({
          userId: userA, type: "skill", statement: "untergeschoben",
          sourceType: "user_stated", confidence: 0.9, userConfirmed: true,
        }),
      ),
    ).rejects.toThrow();
  });

  it("verhindert das Loeschen fremder Daten", async () => {
    await withUser(db, userB, (tx) => tx.delete(s.evidenceItems));
    const stillThere = await withUser(db, userA, (tx) => tx.select().from(s.evidenceItems));
    expect(stillThere).toHaveLength(1);
  });

  it("zeigt ohne gesetzte Kennung gar keine Nutzerdaten", async () => {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE paycheck_app`);
      return tx.select().from(s.evidenceItems);
    });
    expect(rows).toHaveLength(0);
  });

  it("laesst Stellendaten offen lesbar - sie sind nicht personenbezogen", async () => {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE paycheck_app`);
      return tx.select().from(s.jobSources);
    });
    expect(Array.isArray(rows)).toBe(true);
  });

  it("laesst die Rolle nach der Transaktion nicht bestehen", async () => {
    await withUser(db, userA, async (tx) => tx.select().from(s.evidenceItems));
    const who = await db.execute(sql`SELECT current_user AS u`);
    expect((who.rows[0] as { u: string }).u).not.toBe("paycheck_app");
  });
});

describe("Migration", () => {
  it("legt alle erwarteten Tabellen an", async () => {
    const r = await db.execute(sql`
      SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'
    `);
    expect((r.rows[0] as { n: number }).n).toBeGreaterThanOrEqual(50);
  });

  it("laeuft ein zweites Mal, ohne etwas doppelt anzulegen", async () => {
    const second = await runMigrations(db);
    expect(second.applied).toHaveLength(0);
  });
});
