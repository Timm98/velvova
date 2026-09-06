import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Trägt die KldB-Kennung an den Stellen nach.
 *
 * Über zwei vorhandene Tabellen: `beruf_zuordnung` verbindet den
 * bereinigten Stellentitel mit der amtlichen Bezeichnung,
 * `beruf_schluessel` diese mit der KldB-Kennung aus dem DKZ.
 *
 * In Stapeln, weil ein einziges UPDATE über 1,09 Millionen Zeilen die
 * Tabelle für die Dauer sperrt — und der Import läuft weiter.
 *
 * ── Warum `skip locked` und ein Wiederholen ───────────────────
 *
 * Der erste Lauf starb in Runde 2 an einem Verklemmen: Der Import
 * schreibt dieselben Zeilen, beide warten aufeinander, Postgres bricht
 * einen ab. 20.000 Zeilen waren durch, der Rest verloren.
 *
 * `for update skip locked` überspringt, was der Import gerade hält —
 * diese Zeilen kommen in einer späteren Runde dran. Das Wiederholen
 * fängt ab, was trotzdem noch kollidiert. Den Import dafür anzuhalten
 * wäre der teurere Weg gewesen.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const t0 = Date.now();
let gesamt = 0;
for (let runde = 1; ; runde++) {
  let n = 0;
  let fehler = null;
  for (let versuch = 1; versuch <= 5; versuch++) {
    try {
      const r = await db.execute(sql`
        with kandidaten as (
          select j.id, s.schluessel
          from jobs j
          join beruf_zuordnung z on z.titel = lower(btrim(regexp_replace(j.title,
            '\\s*\\(m/w/d\\)|\\s*\\(w/m/d\\)|\\s*m/w/d', '', 'gi')))
          join beruf_schluessel s on s.beruf = z.beruf
          where j.kldb is null and s.schluessel is not null
          order by j.id
          limit 5000
          for update of j skip locked
        )
        update jobs set kldb = k.schluessel from kandidaten k where jobs.id = k.id
      `);
      n = r.rowCount ?? 0;
      fehler = null;
      break;
    } catch (e) {
      fehler = e;
      /* 40P01 ist das Verklemmen. Kurz warten, dann noch einmal. */
      await new Promise((r) => setTimeout(r, 800 * versuch));
    }
  }
  if (fehler) { console.log(`  ! ${String(fehler).slice(0, 90)}`); break; }
  gesamt += n;
  if (n === 0) break;
  if (runde % 10 === 0 || n < 5000) console.log(`  Runde ${runde}: ${n} · gesamt ${gesamt.toLocaleString("de-DE")} · ${((Date.now()-t0)/60000).toFixed(1)} min`);
}
const s = (await db.execute(sql`
  select count(*)::int as gesamt, count(kldb)::int as mit,
         count(distinct left(kldb,2))::int as hauptgruppen
  from jobs where is_demo = false`)).rows[0];
console.log(`\n${Number(s.mit).toLocaleString("de-DE")} von ${Number(s.gesamt).toLocaleString("de-DE")} Stellen mit Kennung (${(100*s.mit/s.gesamt).toFixed(1)} %) · ${s.hauptgruppen} Berufshauptgruppen`);
process.exit(0);
