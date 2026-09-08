import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Den Volltextindex auf den Arbeitgebernamen ohne Sperre anlegen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum neben der Migration
 * ══════════════════════════════════════════════════════════════
 *
 * Migration 0098 legt denselben Index an — mit `create index`, also
 * mit einer Schreibsperre auf `companies`. Für eine frische Umgebung
 * ist das richtig: Dort steht nichts drin, und es dauert nichts.
 *
 * Auf der laufenden Datenbank stehen 416.198 Firmen, und der Import
 * schreibt ununterbrochen in dieselbe Tabelle. Eine Sperre dort hält
 * jede laufende Ernte an. `concurrently` verzichtet darauf und
 * braucht dafür zwei Durchläufe — derselbe Handel wie bei
 * `index-anlegen.mjs` für den Landindex.
 *
 * `concurrently` läuft nicht in einer Transaktion. Deshalb hier und
 * nicht im Migrationsläufer.
 *
 * ── Was der Index bewirkt ───────────────────────────────────
 *
 * Ohne ihn findet die Suche keinen Arbeitgeber. „Landratsamt
 * Karlsruhe" steht weder im Stellentitel noch im Ortsfeld — nur in
 * `companies.name`, und dort war bis zum 8. September 2026 nichts
 * indiziert.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/*
 * Eine Stunde Zeit.
 *
 * Der zweite Durchlauf von `concurrently` wartet auf alle
 * Transaktionen, die beim Start schon offen waren. Läuft gerade ein
 * langer Import, kann das dauern — und ein Abbruch nach dreissig
 * Sekunden liesse einen ungültigen Index zurück, den man von Hand
 * wegräumen muss.
 */
await db.execute(sql`set statement_timeout = '3600s'`);

console.time("Firmenindex");
await db.execute(sql`
  create index concurrently if not exists companies_name_volltext_idx
    on companies using gin (to_tsvector('simple', name))`);
console.timeEnd("Firmenindex");

/*
 * Nachsehen statt annehmen.
 *
 * `if not exists` meldet keinen Fehler, wenn schon etwas da ist — und
 * ein abgebrochener `concurrently`-Lauf hinterlässt einen Index, der
 * existiert, aber ungültig ist. `indisvalid` ist der Unterschied
 * zwischen „angelegt" und „steht da und wird nie benutzt".
 */
const zeilen = (
  await db.execute(sql`
    select i.indisvalid
    from pg_class c
    join pg_index i on i.indexrelid = c.oid
    where c.relname = 'companies_name_volltext_idx'`)
).rows;

if (zeilen.length === 0) console.log("NICHT angelegt");
else if (zeilen[0].indisvalid === false)
  console.log("angelegt, aber UNGÜLTIG — mit `drop index companies_name_volltext_idx` wegräumen und neu laufen lassen");
else console.log("angelegt und gültig");

process.exit(0);
