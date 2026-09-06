import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
for (const q of ["Adzuna", "Bundesagentur für Arbeit", "Arbeitnow", "TheirStack"]) {
  const r = (await db.execute(sql`
    select count(*)::int n,
           round(avg(description_length))::int schnitt,
           min(description_length)::int kurz, max(description_length)::int lang,
           count(*) filter (where description like '%…' or description like '%...')::int abgeschnitten
    from jobs j join job_sources s on s.id = j.source_id
    where s.display_name = ${q}`)).rows[0];
  if (r.n > 0) console.log(`  ${q.padEnd(26)} n=${String(r.n).padStart(5)} · Ø ${String(r.schnitt).padStart(5)} Zeichen · ${r.kurz}–${r.lang} · endet mit „…": ${r.abgeschnitten}`);
}
process.exit(0);
