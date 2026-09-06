import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die Vergleichswerte je Berufsgruppe neu auszählen.
 *
 * Läuft selten — die Mediane bewegen sich über Wochen, nicht über
 * Stunden. Bei jedem Seitenaufruf zu rechnen wären Sekunden für eine
 * Zahl, die sich nicht geändert hat.
 *
 * Nur Deutschland: Die Standzeit hängt am Arbeitsmarkt, und ein
 * niederländischer Median gehört nicht neben eine deutsche Stelle.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/*
 * Die Zeitgrenze hochsetzen, wie in den anderen Vollzähl-Skripten.
 *
 * Sie fehlte hier als einzige. Die Abfrage rechnet zwei Perzentile
 * über rund eine Million deutsche Anzeigen mit Berufskennung — das
 * überschreitet die voreingestellte Grenze, und die Datenbank bricht
 * mit `canceling statement due to statement timeout` ab.
 *
 * Der Lauf scheiterte dadurch bei jeder Pflegerunde mit Code 1, und
 * zwar seit Wochen: Der Pflegelauf protokolliert den Code, macht aber
 * mit der nächsten Aufgabe weiter. Ein Fehler, der nur eine Zeile im
 * Protokoll erzeugt und nichts aufhält, wird nicht bemerkt — die
 * Standzeit-Vergleichswerte blieben einfach leer.
 */
await db.execute(sql`set statement_timeout = '1800s'`);

const r = (await db.execute(sql`
  select
    substring(kldb from 1 for 2) gruppe,
    count(*)::int stellen,
    percentile_cont(0.5) within group (order by extract(epoch from (now() - published_at)) / 86400) median_tage,
    percentile_cont(0.9) within group (order by extract(epoch from (now() - published_at)) / 86400) p90_tage
  from jobs
  where kldb is not null and published_at is not null and country = 'DE'
    /* Älter als drei Jahre ist kein Marktsignal mehr, sondern ein Datenfehler. */
    and published_at > now() - interval '3 years'
  group by 1
  having count(*) > 500`)).rows;

for (const z of r) {
  await db.execute(sql`
    insert into standzeit_referenz (gruppe, stellen, median_tage, p90_tage, berechnet_am)
    values (${z.gruppe}, ${z.stellen}, ${z.median_tage}, ${z.p90_tage}, now())
    on conflict (gruppe) do update set
      stellen = excluded.stellen, median_tage = excluded.median_tage,
      p90_tage = excluded.p90_tage, berechnet_am = now()`);
}
console.log(`${r.length} Berufsgruppen ausgezählt`);
const brauchbar = r.filter((z) => z.stellen >= 3000).length;
console.log(`davon über 3.000 Stellen und damit vergleichstauglich: ${brauchbar}`);
