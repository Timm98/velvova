import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Falsche Landangaben aus dem Bestand nehmen.
 *
 * ══════════════════════════════════════════════════════════════
 * Woher sie kommen
 * ══════════════════════════════════════════════════════════════
 *
 * In `arbeitnow.ts` stand ein Ternär, dessen beide Zweige „DE"
 * ergaben. Jede Anzeige dieser Quelle trug damit Deutschland — auch
 * die aus London, Watford oder Toronto.
 *
 * Gemessen am 7. September 2026: 228 von 4.000 geprüften Anzeigen
 * (5,7 %) tragen ein Land, das ihrer Ortsangabe widerspricht.
 *
 * Die Quelle ist repariert; dieses Skript räumt auf, was vorher
 * hereinkam.
 *
 * ══════════════════════════════════════════════════════════════
 * Was es anfasst
 * ══════════════════════════════════════════════════════════════
 *
 * Nur Zeilen, bei denen die Ortsangabe ein ANDERES Land nennt als
 * die Spalte. Wo nichts erkennbar ist, bleibt alles, wie es ist —
 * eine Vermutung durch eine andere zu ersetzen wäre keine Korrektur.
 *
 * `geo_fassung` wird zurückgesetzt, damit der Geodatenlauf die
 * Koordinaten neu bestimmt: Ein Ort in England war in der deutschen
 * Referenz nicht zu finden, in der britischen schon.
 *
 * Aufruf:  node --experimental-strip-types scripts/land-korrigieren.mjs [--schreiben]
 * Ohne `--schreiben` wird nur gezählt.
 */

const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { landAusOrt } = await import("../packages/jobs/src/sources/landausort.ts");
const db = await getDb();

const schreiben = process.argv.includes("--schreiben");
console.log(schreiben ? "Modus: schreiben\n" : "Modus: nur zählen (--schreiben zum Anwenden)\n");

/*
 * Je Quelle einzeln.
 *
 * Ein Verbund über `job_sources` mit `order by j.id` lief in das
 * Anweisungszeitlimit: Der Index liegt auf `source_id`, nicht auf
 * der Kombination. Die Kennungen einmal zu holen und danach je
 * Quelle zu blättern kostet zwei Abfragen mehr und läuft durch.
 */
const quellen = await db.execute(
  sql`select id, key from job_sources where key in ('arbeitnow','findwork')`,
);

let geprueft = 0;
let falsch = 0;
const nachLand = {};

for (const q of quellen.rows) {
  let cursor = "00000000-0000-0000-0000-000000000000";
  for (let runde = 0; runde < 400; runde++) {
    await db.execute(sql`set statement_timeout='45s'`);
    let zeilen;
    try {
      zeilen = await db.execute(sql`
        select id, location, country from jobs
         where source_id = ${q.id} and id > ${cursor}::uuid
         order by id
         limit 1000`);
    } catch {
      console.log(`  ${q.key}: Abbruch der Datenbank`);
      break;
    }
    if (zeilen.rows.length === 0) break;
    cursor = String(zeilen.rows.at(-1).id);

    for (const z of zeilen.rows) {
      geprueft++;
      const land = landAusOrt(z.location);
      if (!land || land === z.country) continue;
      falsch++;
      nachLand[land] = (nachLand[land] ?? 0) + 1;
      if (schreiben) {
        await db.execute(
          sql`update jobs set country = ${land}, geo_fassung = null where id = ${z.id}::uuid`,
        );
      }
    }
  }
  console.log(`  ${q.key}: ${geprueft} geprüft, ${falsch} falsch`);
}

console.log(`\ngeprüft ${geprueft} · falsch ${falsch} (${((falsch / Math.max(geprueft, 1)) * 100).toFixed(1)} %)`);
console.log("nach Land:", JSON.stringify(nachLand));
process.exit(0);
