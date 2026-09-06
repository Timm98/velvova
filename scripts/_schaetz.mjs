import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const q = async (s) => (await db.execute(s)).rows ?? [];

const [g] = await q(sql`select count(*)::int as n,
  count(*) filter (where salary_min is not null and salary_period='year')::int as jahr,
  count(*) filter (where salary_min is not null and salary_period='month')::int as monat,
  count(*) filter (where salary_min is not null and salary_period='hour')::int as stunde
  from jobs`);
console.log(`Stellen ${g.n} · mit Jahresgehalt ${g.jahr} · Monat ${g.monat} · Stunde ${g.stunde}`);

// Wie viele Stellen je Land/Erfahrungsstufe/Arbeitsmodell haben ein Gehalt?
const je = await q(sql`
  select country, experience_level, count(*)::int as n,
    count(*) filter (where salary_min is not null and salary_period='year')::int as mit
  from jobs group by 1,2 order by n desc limit 12`);
console.log("\nLand / Erfahrung:");
for (const r of je) console.log(`  ${String(r.mit).padStart(4)} / ${String(r.n).padStart(5)}  ${r.country} · ${r.experience_level ?? "—"}`);

// Titelwörter als grobe Berufsgruppe
const titelwort = await q(sql`
  select lower(regexp_replace(split_part(title, ' ', 1), '[^a-zäöüß]', '', 'g')) as wort,
    count(*)::int as n,
    count(*) filter (where salary_min is not null and salary_period='year')::int as mit
  from jobs group by 1 having count(*) > 15 order by mit desc limit 14`);
console.log("\nErstes Titelwort (grobe Gruppe):");
for (const r of titelwort) console.log(`  ${String(r.mit).padStart(3)} / ${String(r.n).padStart(4)}  ${r.wort}`);
process.exit(0);
