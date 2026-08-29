import { loadRuntimeConfig, type RuntimeConfig } from "@paycheck/config";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { resolveDataDir } from "./paths.ts";
import * as schema from "./schema/index.ts";

/**
 * Zwei Treiber, ein SQL.
 *
 * Lokal läuft PGlite: echtes Postgres, in den Prozess eingebettet, ohne
 * Docker und ohne Serverinstallation. In Produktion steht ein richtiger
 * Postgres-Server dahinter. Schema und Migrationen sind identisch, weil
 * beide dieselbe Engine sind - das ist der Grund für diese Wahl und nicht
 * SQLite oder eine Mock-Schicht. Siehe docs/adr/0003.
 */

/**
 * Ein Typ für beide Treiber.
 *
 * Eine Union aus PgliteDatabase und NodePgDatabase wäre naheliegend,
 * bricht aber jede Drizzle-Signatur: TypeScript bildet dann die
 * Schnittmenge der Methoden, und die ist bei generischen Query-Buildern
 * leer. Beide Treiber erben von PgDatabase - das ist der gemeinsame
 * Nenner, an dem der Anwendungscode haengen soll.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Die Instanz hängt bewusst an globalThis, nicht an einer Modulvariablen.
 *
 * Next laedt dieses Paket in mehreren Modul-Graphen - Route Handler und
 * Server Components sind getrennte Bundles. Eine Modulvariable wäre
 * dann mehrfach vorhanden, und jede Kopie würde eine eigene
 * PGlite-Instanz auf dasselbe Verzeichnis öffnen. PGlite ist
 * Einzelschreiber: die zweite Instanz sieht die Schreibvorgänge der
 * ersten nicht.
 *
 * Genau das ist passiert - eine im Route Handler angelegte Sitzung war
 * für die Seiten unsichtbar. Der E2E-Test hat es aufgedeckt.
 */
const GLOBAL_KEY = Symbol.for("paycheck.db.handle");

type Handle = { db: Database; close: () => Promise<void> };
type GlobalWithDb = typeof globalThis & { [GLOBAL_KEY]?: Handle | null };

function readCache(): Handle | null {
  return (globalThis as GlobalWithDb)[GLOBAL_KEY] ?? null;
}

function writeCache(handle: Handle | null): void {
  (globalThis as GlobalWithDb)[GLOBAL_KEY] = handle;
}

export async function getDb(cfg: RuntimeConfig = loadRuntimeConfig()): Promise<Database> {
  return (await getDbHandle(cfg)).db;
}

export async function getDbHandle(cfg: RuntimeConfig = loadRuntimeConfig()): Promise<Handle> {
  const cached = readCache();
  if (cached) return cached;

  if (cfg.db.driver === "pglite") {
    const { PGlite } = await import("@electric-sql/pglite");
    const client = new PGlite(resolveDataDir(cfg.db.pgliteDataDir));
    await client.waitReady;
    const db = drizzlePglite(client, { schema }) as unknown as Database;
    const handle: Handle = {
      db,
      close: async () => {
        await client.close();
        writeCache(null);
      },
    };
    writeCache(handle);
    return handle;
  }

  if (!cfg.db.url) {
    throw new Error(
      "DATABASE_DRIVER=pg gewählt, aber DATABASE_URL fehlt. " +
        "Setze DATABASE_URL oder nutze DATABASE_DRIVER=pglite für die lokale Entwicklung.",
    );
  }
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: cfg.db.url, max: 10 });
  const db = drizzleNode(pool, { schema }) as unknown as Database;
  const handle: Handle = {
    db,
    close: async () => {
      await pool.end();
      writeCache(null);
    },
  };
  writeCache(handle);
  return handle;
}

/** Für Tests: eine frische Datenbank im Arbeitsspeicher, ohne Datei. */
export async function createInMemoryDb(): Promise<{ db: Database; close: () => Promise<void> }> {
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite();
  await client.waitReady;
  return { db: drizzlePglite(client, { schema }) as unknown as Database, close: () => client.close() };
}

export { schema };
