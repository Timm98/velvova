import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die grossen Berufe über die Ortsachse holen.
 *
 * ── Wozu ──────────────────────────────────────────────────────
 *
 * Die Jobbörse gibt je Suchbegriff höchstens 10.000 Anzeigen heraus.
 * „Elektroniker" hat 42.889 — drei Viertel davon waren unerreichbar.
 * Mit einem Ort beginnt die Zählung von vorn: im Umkreis von 50 km um
 * Berlin sind es 2.156, um Köln 2.507. Jede Zahl weit unter der
 * Grenze.
 *
 * Betroffen sind nur die grossen Berufe — unter 8.000 Anzeigen ist ein
 * Beruf mit einer einzigen Suche vollständig erreichbar, und ihn
 * trotzdem nach sechsundfünfzig Orten aufzuteilen wäre sechsundfünfzig
 * Mal dieselbe Frage.
 *
 * Aufruf:
 *   node --experimental-strip-types scripts/bestand-nach-orten.mjs [teil] [vonTeilen]
 */
const { BundesagenturAdapter } = await import("../packages/jobs/src/sources/bundesagentur.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");
const { ORTE_DE, ORTSACHSE_AB } = await import("../packages/jobs/src/orte.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const teil = Number(process.argv[2] ?? 1);
const vonTeilen = Number(process.argv[3] ?? 1);

const gross = (await db.execute(sql`
  select beruf, anzeigen from beruf_wortschatz
  where anzeigen >= ${ORTSACHSE_AB} order by anzeigen desc`)).rows
  .filter((_, i) => i % vonTeilen === teil - 1);

const vorher = (await db.execute(sql`select count(*)::int n from jobs where is_demo=false`)).rows[0].n;
console.log(`${gross.length} grosse Berufe (Teil ${teil}/${vonTeilen}) · ${ORTE_DE.length} Orte · Bestand ${vorher}`);
console.log(`Erreichbar ohne Ortsachse: ${gross.reduce((a, b) => a + Math.min(b.anzeigen, 10000), 0).toLocaleString("de-DE")}`);
console.log(`Tatsächlich vorhanden:     ${gross.reduce((a, b) => a + b.anzeigen, 0).toLocaleString("de-DE")}\n`);

const t0 = Date.now();
let neu = 0;

for (const [i, { beruf, anzeigen }] of gross.entries()) {
  /*
   * Ein Beruf, alle Orte, in Abschnitten.
   *
   * Nicht alle Orte auf einmal: Der Adapter blättert reihum über alle
   * Suchpaare, und 56 Orte à 100 Seiten wären ein Lauf von Stunden,
   * dessen Zwischenstand erst am Ende geschrieben wird.
   */
  for (let o = 0; o < ORTE_DE.length; o += 8) {
    const orte = ORTE_DE.slice(o, o + 8);
    try {
      const r = await ingestFromAdapter(
        new BundesagenturAdapter({ abfragen: [beruf], orte, pauseMs: 60, gleichzeitig: 8 }),
        { limit: 4000 },
      );
      neu += r.inserted;
      if (r.failed > 0) for (const e of r.errors.slice(0, 1)) console.log(`      ! ${e}`);
    } catch (e) {
      console.log(`      ! ${beruf}: ${String(e instanceof Error ? e.message : e).slice(0, 100)}`);
    }
  }
  const min = (Date.now() - t0) / 60000;
  const jetzt = (await db.execute(sql`select count(*)::int n from jobs where is_demo=false`)).rows[0].n;
  console.log(
    `  ${i + 1}/${gross.length} ${String(beruf).slice(0, 40).padEnd(42)} ` +
      `(${String(anzeigen).padStart(6)} Anzeigen) · neu gesamt ${neu} · Bestand ${jetzt} · ${min.toFixed(0)} min`,
  );
}
console.log(`\nFertig: ${neu} neue Stellen in ${((Date.now() - t0) / 60000).toFixed(0)} Minuten.`);
process.exit(0);
