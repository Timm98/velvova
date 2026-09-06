import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [q] = (await db.execute(sql`select id from job_sources where key = 'bundesagentur'`)).rows;
const K = { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "Paycheck/1.0" };

/* Zwei Fragen: nimmt `wo` eine PLZ an, und wie viel Unbekanntes liegt dort? */
const PROBEN = ["17291", "19322", "37154", "54595", "94469", "08525", "26789", "97980", "24837", "36037"];
let gesamtNeu = 0, gesamtProbe = 0;
for (const plz of PROBEN) {
  const url = new URL("https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs");
  url.searchParams.set("wo", plz);
  url.searchParams.set("umkreis", "25");
  url.searchParams.set("size", "100");
  url.searchParams.set("page", "1");
  try {
    const a = await fetch(url, { headers: K, signal: AbortSignal.timeout(25000) });
    if (!a.ok) { console.log(`${plz}  HTTP ${a.status}`); continue; }
    const d = await a.json();
    const refs = (d.ergebnisliste ?? []).map((s) => s.referenznummer).filter(Boolean);
    if (!refs.length) { console.log(`${plz}  keine Treffer`); continue; }
    const liste = sql.join(refs.map((r) => sql`${r}`), sql`, `);
    const bekannt = (await db.execute(sql`
      select count(*)::int n from job_source_links
      where source_id = ${q.id}::uuid and external_id in (${liste})`)).rows[0].n;
    const neu = refs.length - bekannt;
    gesamtNeu += neu; gesamtProbe += refs.length;
    console.log(`${plz}  ${String(d.maxErgebnisse ?? 0).padStart(6)} gesamt · Stichprobe ${String(refs.length).padStart(3)} · neu ${String(neu).padStart(3)}`);
  } catch (e) { console.log(`${plz}  Fehler ${String(e.message ?? e).slice(0, 40)}`); }
  await new Promise((r) => setTimeout(r, 800));
}
console.log(`\nzusammen: ${gesamtNeu} von ${gesamtProbe} unbekannt (${(100*gesamtNeu/Math.max(1,gesamtProbe)).toFixed(0)} %)`);
