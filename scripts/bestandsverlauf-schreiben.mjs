import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Eine Messung des Bestands festhalten.
 *
 * Läuft im stündlichen Pflegelauf, nach `laender-zaehlen`. Die Zahlen
 * kommen aus den bereits vorberechneten Tabellen — hier wird nichts
 * neu gezählt, nur festgehalten.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const [a] = (await db.execute(sql`
  select coalesce(sum(stellen), 0)::bigint stellen, count(*)::int laender from laenderbestand`)).rows;
const [q] = (await db.execute(sql`
  select count(*)::int n from job_sources where enabled = true`)).rows;

await db.execute(sql`
  insert into bestandsverlauf (gemessen_am, stellen, laender, quellen)
  values (date_trunc('hour', now()), ${Number(a.stellen)}, ${Number(a.laender)}, ${Number(q.n)})
  on conflict (gemessen_am) do update
    set stellen = excluded.stellen, laender = excluded.laender, quellen = excluded.quellen`);

/* Älter als 400 Tage braucht niemand — die Anzeige reicht 30 Tage zurück. */
await db.execute(sql`delete from bestandsverlauf where gemessen_am < now() - interval '400 days'`);

console.log(`${Number(a.stellen).toLocaleString("de")} Stellen · ${a.laender} Länder · ${q.n} Quellen festgehalten`);
process.exit(0);
