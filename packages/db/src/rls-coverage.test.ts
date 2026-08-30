import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, type Database } from "./client.ts";
import { runMigrations } from "./migrate.ts";

/**
 * Jede Tabelle mit einer Nutzerkennung braucht einen Zeilenfilter.
 *
 * Diese Prüfung hat drei Lücken gefunden, die niemandem beim Lesen
 * aufgefallen waren: `auth_accounts`, `memberships` und `ai_runs` trugen
 * eine `user_id` und hatten kein aktives RLS. Sie sahen geschützt aus.
 *
 * Der Fehler passiert nicht beim Anlegen der Richtlinien, sondern beim
 * Anlegen der nächsten Tabelle: die Liste in `rls.sql` wird vergessen,
 * und niemand merkt es, weil nichts kaputtgeht. Kaputt ist nur die
 * Aussage, dass niemand fremde Daten sieht.
 */

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  const handle = await createInMemoryDb();
  db = handle.db;
  close = handle.close;
  await runMigrations(db);
}, 120_000);

afterAll(async () => {
  await close?.();
});

describe("RLS-Abdeckung", () => {
  it("schützt jede Tabelle, die eine Nutzerkennung trägt", async () => {
    const result = (await db.execute(sql`
      SELECT c.relname AS tabelle
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN information_schema.columns col
        ON col.table_schema = 'public'
       AND col.table_name = c.relname
       AND col.column_name = 'user_id'
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
      GROUP BY c.relname
      ORDER BY c.relname
    `)) as unknown as { rows: { tabelle: string }[] };

    expect(result.rows.map((r) => r.tabelle)).toEqual([]);
  });

  it("hinterlegt zu jedem aktivierten RLS auch eine Richtlinie", async () => {
    // RLS ohne Richtlinie sperrt alles — das fällt sofort auf. Der
    // umgekehrte Fall ist der gefährliche, aber dieser hier kostet
    // einen halben Tag Fehlersuche und ist billig zu verhindern.
    const result = (await db.execute(sql`
      SELECT c.relname AS tabelle
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
        AND NOT EXISTS (
          SELECT 1 FROM pg_policies p
          WHERE p.schemaname = 'public' AND p.tablename = c.relname
        )
      ORDER BY c.relname
    `)) as unknown as { rows: { tabelle: string }[] };

    expect(result.rows.map((r) => r.tabelle)).toEqual([]);
  });

  it("filtert ohne gesetzte Kennung alles heraus", async () => {
    // Ein vergessenes withUser() darf keine fremden Zeilen liefern.
    // `user_id = NULL` ist niemals wahr — die Antwort ist leer, nicht
    // vollständig. Das ist der Unterschied zwischen einem Ausfall und
    // einem Datenleck.
    const leer = await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE paycheck_app`);
      return (await tx.execute(
        sql`SELECT count(*)::int AS n FROM evidence_items`,
      )) as unknown as { rows: { n: number }[] };
    });

    expect(leer.rows[0]?.n ?? -1).toBe(0);
  });
});
