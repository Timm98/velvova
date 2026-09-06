import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Adzuna über die Kategorienachse.
 *
 * ── Warum ohne sie fast nichts geht ───────────────────────────
 *
 * Adzuna führt 12,37 Millionen Anzeigen in 19 Ländern. Je Abfrage sind
 * aber höchstens 5.000 erreichbar: Ab Seite 100 wiederholen sich die
 * Ergebnisse — Seite 100, 200, 500 und 2.000 liefern denselben ersten
 * Treffer.
 *
 * Ohne weitere Achse bleiben also 99,9 % der amerikanischen 6,7
 * Millionen unerreichbar, egal wie oft man fragt. Wer das nicht misst,
 * importiert zehntausendmal dieselben fünftausend Anzeigen und hält
 * den Bestand für gewachsen.
 *
 * Eine Kategorie beginnt die Zählung von vorn — dieselbe Technik, die
 * bei der Bundesagentur von 52 auf 76 % geführt hat.
 *
 * 30 Kategorien × 19 Länder × 5.000 = 2,85 Millionen theoretisch.
 * „Theoretisch", weil sich Kategorien überschneiden: Eine Anzeige
 * steht oft in mehreren.
 *
 * Aufruf: node --experimental-strip-types scripts/adzuna-kategorien.mjs [land] [teil] [vonTeilen]
 */
const { AdzunaAdapter } = await import("../packages/jobs/src/sources/adzuna.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const land = (process.argv[2] ?? "de").toLowerCase();
const teil = Number(process.argv[3] ?? 1);
const vonTeilen = Number(process.argv[4] ?? 1);

const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
const r = await fetch(
  `https://api.adzuna.com/v1/api/jobs/${land}/categories?app_id=${id}&app_key=${key}&content-type=application/json`,
  { signal: AbortSignal.timeout(20000) },
);
if (!r.ok) { console.error(`Kategorien nicht abrufbar: HTTP ${r.status}`); process.exit(1); }
const alle = ((await r.json()).results ?? []).map((k) => k.tag);
const kategorien = alle.filter((_, i) => i % vonTeilen === teil - 1);

/* Schätzwert: count(*) über 1,58 Mio. Zeilen bricht unter Importlast in die Zeitgrenze. */
const vorher = Number((await db.execute(sql`select reltuples::bigint n from pg_class where relname = 'jobs'`)).rows[0].n);
console.log(`${land.toUpperCase()} · ${kategorien.length} von ${alle.length} Kategorien · Bestand ${vorher}\n`);

const t0 = Date.now();
let neu = 0;
for (const [i, k] of kategorien.entries()) {
  try {
    const e = await ingestFromAdapter(
      new AdzunaAdapter({ country: land, kategorie: k }),
      { limit: 5000 },
    );
    neu += e.inserted;
    const jetzt = Number((await db.execute(sql`select reltuples::bigint n from pg_class where relname = 'jobs'`)).rows[0].n);
    console.log(
      `  ${String(i + 1).padStart(2)}/${kategorien.length} ${k.padEnd(30)} ` +
      `geholt ${String(e.fetched).padStart(5)} · neu ${String(e.inserted).padStart(5)} · ` +
      `Bestand ${jetzt} · ${((Date.now() - t0) / 60000).toFixed(0)} min`,
    );
  } catch (e) {
    console.log(`  ! ${k}: ${String(e instanceof Error ? e.message : e).slice(0, 70)}`);
  }
}
console.log(`\nFertig: ${neu} neue Stellen aus ${land.toUpperCase()}.`);
process.exit(0);
