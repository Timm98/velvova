import { loadRuntimeConfig, type RuntimeConfig } from "@paycheck/config";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { resolveDataDir } from "./paths.ts";
import * as schema from "./schema/index.ts";
import { acquirePgliteLock } from "./lock.ts";

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
    const dataDir = resolveDataDir(cfg.db.pgliteDataDir);

    /*
     * Erst die Sperre, dann die Datenbank.
     *
     * PGlite ist Einzelschreiber. Ein zweiter Prozess auf demselben
     * Verzeichnis zerlegt beiden den WASM-Speicher, und heraus kommt
     * "Aborted(). Build with -sASSERTIONS for more info." — eine Zeile,
     * die niemandem sagt, was passiert ist, und die auf einer
     * beliebigen Seite auftaucht, die gerade die Datenbank anfasst.
     *
     * Die Sperre wirft stattdessen einen Satz, den man lesen kann.
     */
    const lock = acquirePgliteLock(dataDir);

    const { PGlite } = await import("@electric-sql/pglite");
    const client = new PGlite(dataDir);
    await client.waitReady;
    const db = drizzlePglite(client, { schema }) as unknown as Database;
    const handle: Handle = {
      db,
      close: async () => {
        await client.close();
        lock.release();
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
  const pool = new Pool({ connectionString: libpqSemantik(cfg.db.url), max: 10 });
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

/**
 * TLS für Postgres — und warum hier überhaupt etwas stehen muss.
 *
 * ══════════════════════════════════════════════════════════════
 * `sslmode=require` heisst nicht mehr, was es immer hiess
 * ══════════════════════════════════════════════════════════════
 *
 * In libpq — und damit in jeder Dokumentation, aus der jemand einen
 * Verbindungsstring kopiert — bedeutet `require`: verschlüsseln, aber
 * das Zertifikat NICHT prüfen. Wer prüfen will, schreibt `verify-ca`
 * oder `verify-full`.
 *
 * `pg` 8.23 hat das geändert und prüft bei `require` mit. Gegen
 * Supabases Pooler scheitert das:
 *
 *     self-signed certificate in certificate chain
 *
 * Gemessen am 8. September 2026 gegen
 * `aws-1-eu-west-1.pooler.supabase.com`: mit `sslmode=require` allein
 * kam keine Verbindung zustande, mit libpq-Semantik sofort — und
 * dahinter standen die erwarteten 3.482.474 Stellen.
 *
 * ── Warum das so teuer war ──────────────────────────────────
 *
 * Weil nichts danach aussah. Der Bau lief durch, die Seite lud, und
 * die Stellenzahl stand auf null — die Abfrage fing ihren Fehler ab.
 * Ein Verbindungsfehler, den niemand sieht, kostet mehr Zeit als
 * einer, der laut ist.
 *
 * ── Was hier NICHT passiert ─────────────────────────────────
 *
 * Kein pauschales Abschalten der Prüfung. Wer `verify-ca` oder
 * `verify-full` in den String schreibt, hat sich ausdrücklich für die
 * Prüfung entschieden, und die bleibt unangetastet. Angeglichen wird
 * nur `require` — auf genau die Bedeutung, die es in libpq hat.
 */
function libpqSemantik(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    /* Kein zerlegbarer String: unverändert durchreichen, `pg` meldet
       den Fehler dann selbst und deutlicher als wir es könnten. */
    return url;
  }

  const modus = u.searchParams.get("sslmode");

  /* Wer ausdrücklich prüfen will, bekommt seine Prüfung. */
  if (modus === "verify-ca" || modus === "verify-full" || modus === "disable") return url;

  /*
   * `require`, `prefer`, `allow` und der Fall ohne Angabe.
   *
   * Der Schalter kommt aus `pg`s eigener Warnung — er stellt genau die
   * Bedeutung wieder her, die `sslmode` in libpq immer hatte. Das ist
   * keine Lockerung, sondern die Auflösung einer Abweichung.
   */
  if (!u.searchParams.has("uselibpqcompat")) {
    u.searchParams.set("uselibpqcompat", "true");
    if (!modus) u.searchParams.set("sslmode", "require");
  }
  return u.toString();
}

/** Für Tests: eine frische Datenbank im Arbeitsspeicher, ohne Datei. */
export async function createInMemoryDb(): Promise<{ db: Database; close: () => Promise<void> }> {
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite();
  await client.waitReady;
  return { db: drizzlePglite(client, { schema }) as unknown as Database, close: () => client.close() };
}

export { schema };
