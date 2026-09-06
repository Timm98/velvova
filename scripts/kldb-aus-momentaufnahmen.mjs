import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die KldB-Kennung aus dem, was die Jobbörse ohnehin mitschickt.
 *
 * ── Der Umweg, den es nicht gebraucht hätte ───────────────────
 *
 * Bisher lief die Zuordnung über einen Netzaufruf je Stellentitel:
 * Titel bereinigen, bei der Jobbörse nachfragen, Ergebnis ablegen. Bei
 * 433.268 Titeln kam die Abdeckung nach Stunden auf 26 %.
 *
 * Dabei steht die Antwort seit dem ersten Import in der Datenbank.
 * Jede Anzeige trägt `hauptberuf` — die amtliche Bezeichnung, von der
 * Behörde vergeben, nicht geraten. Der Adapter liest sie und legt sie
 * in `job_snapshots.raw_payload` ab. 3.733 der 3.734 verschiedenen
 * Werte finden sich im DKZ wieder; dahinter stehen 768.096 Stellen.
 *
 * ── Warum erst eine Tabelle und dann das UPDATE ───────────────
 *
 * Die erste Fassung suchte in JEDER Runde neu über 1,16 Millionen
 * Momentaufnahmen — mit `distinct on` und Sortierung. Sie schaffte
 * 40.000 Zeilen, bevor mir auffiel, dass die Arbeit dabei
 * zweihundertmal getan wird.
 *
 * Jetzt einmal: eine Zuordnungstabelle mit Index, danach schreiben.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const t0 = Date.now();
console.log("Zuordnung aufbauen …");
await db.execute(sql`drop table if exists kldb_zuordnung`);
await db.execute(sql`
  create unlogged table kldb_zuordnung as
  select distinct on (m.job_id) m.job_id, s.schluessel
  from job_snapshots m
  join beruf_schluessel s
    on s.beruf = m.raw_payload->>'hauptberuf' and s.schluessel is not null
  order by m.job_id, m.fetched_at desc`);
await db.execute(sql`alter table kldb_zuordnung add primary key (job_id)`);
const n0 = (await db.execute(sql`select count(*)::int n from kldb_zuordnung`)).rows[0].n;
console.log(`  ${Number(n0).toLocaleString("de-DE")} Zuordnungen in ${((Date.now()-t0)/1000).toFixed(0)} s\n`);

let gesamt = 0;
for (let runde = 1; ; runde++) {
  let n = 0;
  let fehler = null;
  for (let versuch = 1; versuch <= 5; versuch++) {
    try {
      const r = await db.execute(sql`
        with stapel as (
          select j.id, z.schluessel
          from jobs j join kldb_zuordnung z on z.job_id = j.id
          where j.kldb is null
          limit 20000
          for update of j skip locked
        )
        update jobs set kldb = s.schluessel from stapel s where jobs.id = s.id`);
      n = r.rowCount ?? 0;
      fehler = null;
      break;
    } catch (e) {
      fehler = e;
      await new Promise((r) => setTimeout(r, 700 * versuch));
    }
  }
  if (fehler) { console.log(`  ! ${String(fehler).slice(0, 80)}`); break; }
  gesamt += n;
  if (n === 0) break;
  console.log(`  Runde ${runde} · ${gesamt.toLocaleString("de-DE")} · ${((Date.now()-t0)/60000).toFixed(1)} min`);
}

await db.execute(sql`drop table if exists kldb_zuordnung`);
const s = (await db.execute(sql`
  select count(*)::int gesamt, count(kldb)::int mit,
         count(distinct left(kldb,2))::int hauptgruppen
  from jobs where is_demo=false`)).rows[0];
console.log(`\n${Number(s.mit).toLocaleString("de-DE")} von ${Number(s.gesamt).toLocaleString("de-DE")} mit Kennung (${(100*s.mit/s.gesamt).toFixed(1)} %) · ${s.hauptgruppen} Berufshauptgruppen`);
process.exit(0);
