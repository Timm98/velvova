import { loadRuntimeConfig, type RuntimeConfig } from "@paycheck/config";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzleNode, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { resolveDataDir } from "./paths.ts";
import * as schema from "./schema/index.ts";

/**
 * Zwei Treiber, ein SQL.
 *
 * Lokal laeuft PGlite: echtes Postgres, in den Prozess eingebettet, ohne
 * Docker und ohne Serverinstallation. In Produktion steht ein richtiger
 * Postgres-Server dahinter. Schema und Migrationen sind identisch, weil
 * beide dieselbe Engine sind - das ist der Grund fuer diese Wahl und nicht
 * SQLite oder eine Mock-Schicht. Siehe docs/adr/0003.
 */

export type Database = PgliteDatabase<typeof schema> | NodePgDatabase<typeof schema>;

let cached: { db: Database; close: () => Promise<void> } | null = null;

export async function getDb(cfg: RuntimeConfig = loadRuntimeConfig()): Promise<Database> {
  return (await getDbHandle(cfg)).db;
}

export async function getDbHandle(
  cfg: RuntimeConfig = loadRuntimeConfig(),
): Promise<{ db: Database; close: () => Promise<void> }> {
  if (cached) return cached;

  if (cfg.db.driver === "pglite") {
    const { PGlite } = await import("@electric-sql/pglite");
    const client = new PGlite(resolveDataDir(cfg.db.pgliteDataDir));
    await client.waitReady;
    const db = drizzlePglite(client, { schema });
    cached = { db, close: async () => { await client.close(); cached = null; } };
    return cached;
  }

  if (!cfg.db.url) {
    throw new Error(
      "DATABASE_DRIVER=pg gewaehlt, aber DATABASE_URL fehlt. " +
        "Setze DATABASE_URL oder nutze DATABASE_DRIVER=pglite fuer die lokale Entwicklung.",
    );
  }
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: cfg.db.url, max: 10 });
  const db = drizzleNode(pool, { schema });
  cached = { db, close: async () => { await pool.end(); cached = null; } };
  return cached;
}

/** Fuer Tests: eine frische Datenbank im Arbeitsspeicher, ohne Datei. */
export async function createInMemoryDb(): Promise<{ db: Database; close: () => Promise<void> }> {
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite();
  await client.waitReady;
  return { db: drizzlePglite(client, { schema }), close: () => client.close() };
}

export { schema };
