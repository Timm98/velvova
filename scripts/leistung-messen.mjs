/**
 * Messwerte statt Eindrücke.
 *
 * Jede Zahl mehrfach gemessen und als Median ausgegeben: ein einzelner
 * Lauf misst mit, was gerade sonst noch auf der Maschine passiert.
 *
 *   node scripts/leistung-messen.mjs
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

async function miss(name, fn, laeufe = 7) {
  await fn(); // einmal warmlaufen — der erste Lauf misst den Verbindungsaufbau mit
  const zeiten = [];
  for (let i = 0; i < laeufe; i++) {
    const t = performance.now();
    await fn();
    zeiten.push(performance.now() - t);
  }
  console.log(`  ${name.padEnd(40)} ${median(zeiten).toFixed(0).padStart(5)} ms  (min ${Math.min(...zeiten).toFixed(0)}, max ${Math.max(...zeiten).toFixed(0)})`);
}

console.log("══ Datenbankabfragen ══\n");

await miss("Jobliste: 25 Stellen mit Firma+Quelle", async () => {
  await db.execute(sql`
    select j.id, j.title, j.location, j.work_model, j.salary_min, j.salary_max,
           j.salary_disclosed, j.salary_provenance, j.published_at,
           c.name as firma, s.display_name as quelle
    from jobs j
    join companies c on c.id = j.company_id
    join job_sources s on s.id = j.source_id
    order by j.published_at desc nulls last
    limit 25
  `);
});

await miss("Jobliste: Seite 3 (offset 50)", async () => {
  await db.execute(sql`
    select j.id, j.title from jobs j order by j.published_at desc nulls last limit 25 offset 50
  `);
});

await miss("Jobliste: alle Kennungen (Rangfolge)", async () => {
  await db.execute(sql`select id, content_hash, published_at from jobs`);
});

const [einer] = (await db.execute(sql`select id from jobs limit 1`)).rows ?? [];
await miss("Jobdetail: eine Stelle mit Beschreibung", async () => {
  await db.execute(sql`
    select j.*, c.name as firma, s.display_name as quelle
    from jobs j join companies c on c.id = j.company_id join job_sources s on s.id = j.source_id
    where j.id = ${einer.id}
  `);
});

await miss("Zählung gesamt", async () => {
  await db.execute(sql`select count(*)::int from jobs`);
});

console.log("\n══ Rechnen im Speicher ══\n");
const { checkConstraints } = await import("../packages/matching/src/constraints.ts");
const { makeConstraints, makeJob } = await import("../packages/matching/src/fixtures.ts");
const { fuehreZusammen } = await import("../packages/jobs/src/zusammenfuehren.ts");
const { gehaltAusText } = await import("../packages/jobs/src/gehalt-aus-text.ts");

const c = makeConstraints({});
const jobs = Array.from({ length: 1160 }, (_, i) => makeJob({ id: `j${i}` }));
await miss("Bedingungsprüfung, 1160 Stellen", async () => { for (const j of jobs) checkConstraints(j, c); }, 5);

const texte = ((await db.execute(sql`select description from jobs limit 500`)).rows ?? []).map((z) => z.description);
await miss("Gehaltsextraktion, 500 Texte", async () => { for (const t of texte) gehaltAusText(t); }, 5);

const eingang = jobs.slice(0, 300).map((j, i) => ({
  provider: i % 2 ? "a" : "b", herkunft: "aggregator",
  listing: { externalId: `x${i}`, title: `Titel ${i % 60}`, companyName: `Firma ${i % 40}`,
             location: "Karlsruhe", description: `Beschreibung Nummer ${i} mit genügend Wörtern für eine sinnvolle Prüfung des Vergleichs.`,
             originalUrl: `https://f.de/${i}` },
}));
await miss("Zusammenführung, 300 Sätze", async () => { fuehreZusammen(eingang); }, 5);

process.exit(0);
