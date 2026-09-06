import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die Kennzahlen für das Diagramm auf der Startseite.
 *
 * Vier Zählungen über die deutschen Anzeigen: wie viele ohne
 * Gehaltsangabe, wie viele älter als ein halbes Jahr, wie viele ohne
 * amtliche Berufskennung.
 *
 * Läuft im stündlichen Pflegelauf. In der Seite wäre das unmöglich:
 * `count(*) filter (...)` über 2,5 Mio. Zeilen dauert Minuten.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
await db.execute(sql`set statement_timeout = '1500s'`);

const t0 = Date.now();
const [a] = (await db.execute(sql`
  select
    count(*)::bigint gesamt,
    count(*) filter (where not salary_disclosed)::bigint ohne_gehalt,
    count(*) filter (where published_at < now() - interval '6 months')::bigint alt,
    count(*) filter (where kldb is null)::bigint ohne_kennung
  from jobs
  where is_demo = false and country = 'DE'`)).rows;

await db.execute(sql`
  insert into bestandsbefund (gemessen_am, grundgesamtheit, ohne_gehalt, alt, ohne_kennung)
  values (date_trunc('hour', now()), ${Number(a.gesamt)}, ${Number(a.ohne_gehalt)},
          ${Number(a.alt)}, ${Number(a.ohne_kennung)})
  on conflict (gemessen_am) do update set
    grundgesamtheit = excluded.grundgesamtheit,
    ohne_gehalt = excluded.ohne_gehalt,
    alt = excluded.alt,
    ohne_kennung = excluded.ohne_kennung`);

/* Älter als 90 Tage braucht die Anzeige nicht. */
await db.execute(sql`delete from bestandsbefund where gemessen_am < now() - interval '90 days'`);

const p = (n) => ((Number(n) / Number(a.gesamt)) * 100).toFixed(1);
console.log(`${Number(a.gesamt).toLocaleString("de")} DE-Anzeigen in ${((Date.now()-t0)/1000).toFixed(0)} s`);
console.log(`  ohne Gehalt ${p(a.ohne_gehalt)} % · älter als 6 Monate ${p(a.alt)} % · ohne Kennung ${p(a.ohne_kennung)} %`);
process.exit(0);
