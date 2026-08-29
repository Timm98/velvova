import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRuntimeConfig } from "@paycheck/config";
import { sql } from "drizzle-orm";
import { getDbHandle, type Database } from "./client.ts";

/**
 * Migrationen anwenden. Bewusst schlicht: die von drizzle-kit erzeugten
 * SQL-Dateien werden der Reihe nach ausgefuehrt und in einer Tabelle
 * vermerkt. Danach folgen die RLS-Richtlinien, die bei jedem Lauf neu
 * gesetzt werden - sie sind idempotent.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "drizzle");

/**
 * Der Treiber fuehrt je Aufruf genau eine Anweisung aus. Auf ";" zu
 * trennen waere falsch - Semikolons stehen auch innerhalb von $$-Bloecken.
 * Deshalb derselbe explizite Marker, den drizzle-kit ohnehin setzt.
 */
function splitStatements(raw: string): string[] {
  return raw
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^(--[^\n]*\n?)+$/.test(s));
}

export async function runMigrations(db: Database): Promise<{ applied: string[]; skipped: number }> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const done = new Set(
    ((await db.execute(sql`SELECT name FROM _migrations`)).rows as { name: string }[]).map((r) => r.name),
  );

  const files = existsSync(migrationsDir)
    ? (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort()
    : [];

  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const raw = await readFile(path.join(migrationsDir, file), "utf8");
    // drizzle-kit trennt Anweisungen mit diesem Marker.
    for (const statement of splitStatements(raw)) {
      await db.execute(sql.raw(statement));
    }
    await db.execute(sql`INSERT INTO _migrations (name) VALUES (${file})`);
    applied.push(file);
  }

  // RLS zuletzt, damit die Tabellen existieren. Idempotent, laeuft immer.
  const rls = await readFile(path.join(here, "rls.sql"), "utf8");
  for (const statement of splitStatements(rls)) {
    await db.execute(sql.raw(statement));
  }

  return { applied, skipped: files.length - applied.length };
}

const isMain = process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`;
if (isMain) {
  const cfg = loadRuntimeConfig();
  const { db, close } = await getDbHandle(cfg);
  const result = await runMigrations(db);
  console.log(
    `Migrationen: ${result.applied.length} angewendet, ${result.skipped} bereits vorhanden ` +
      `(Treiber: ${cfg.db.driver}${cfg.db.driver === "pglite" ? `, Verzeichnis: ${cfg.db.pgliteDataDir}` : ""}).`,
  );
  if (result.applied.length > 0) console.log("  " + result.applied.join("\n  "));
  await close();
}
