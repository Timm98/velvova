import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Trägt Koordinaten an den Stellen nach.
 *
 * ── Warum das lohnt ───────────────────────────────────────────
 *
 * `jobs.latitude` und `longitude` gibt es seit dem ersten Entwurf.
 * Gefüllt sind sie bei null von 1,14 Millionen Stellen. Der Arbeitsweg
 * funktioniert trotzdem — er löst die Ortsangabe bei jedem Aufruf neu
 * auf und legt das Ergebnis in `geo_orte` ab.
 *
 * Das heisst: Jede Stellenseite, deren Ort noch nicht im Zwischen-
 * speicher steht, spricht mit einem fremden Dienst, bevor sie fertig
 * ist. Bei einem Bestand mit zehntausenden verschiedener Orte trifft
 * das ständig jemanden.
 *
 * ── Warum über `geo_orte` und nicht direkt ────────────────────
 *
 * Die Orte wiederholen sich massiv: „Berlin" steht an zehntausenden
 * Stellen. Erst die verschiedenen Orte auflösen, dann die Koordinaten
 * auf alle Stellen mit diesem Ort schreiben — das sind ein paar tausend
 * Anfragen statt einer Million.
 *
 * Nominatim erlaubt eine Anfrage je Sekunde. Daran halten wir uns.
 *
 * Aufruf: node --experimental-strip-types scripts/koordinaten-nachtragen.mjs [anzahl]
 */
const { ortAufloesen } = await import("../apps/web/src/lib/geo/arbeitsweg.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const grenze = Number(process.argv[2] ?? 500);

/* Die häufigsten Orte zuerst — dort hängen die meisten Stellen dran. */
const orte = (await db.execute(sql`
  select j.location, j.country, count(*)::int as n
  from jobs j
  where j.is_demo = false and j.latitude is null
    and j.location is not null and j.location <> ''
    and j.location !~* '^(deutschland|germany|österreich|austria|schweiz|switzerland|remote|homeoffice)$'
  group by j.location, j.country
  order by n desc
  limit ${grenze}`)).rows;

console.log(`${orte.length} verschiedene Orte · zusammen ${orte.reduce((a,o)=>a+Number(o.n),0).toLocaleString("de-DE")} Stellen\n`);

const t0 = Date.now();
let gefunden = 0, ohne = 0, geschrieben = 0;

for (const [i, o] of orte.entries()) {
  const k = await ortAufloesen(String(o.location), String(o.country)).catch(() => null);
  if (!k) { ohne++; }
  else {
    gefunden++;
    /*
     * In Stapeln, ausweichend, wiederholend.
     *
     * „Berlin, Berlin" steht an zehntausenden Stellen. Ein einziges
     * UPDATE darüber sperrt sie alle — und der Import schreibt
     * gleichzeitig dieselben Zeilen. Der erste Lauf starb genau daran:
     * „deadlock detected", nach dem ersten Ort.
     *
     * `for update skip locked` überspringt, was der Import gerade hält;
     * die Zeilen kommen im nächsten Stapel dran.
     */
    for (let versuch = 0; versuch < 200; versuch++) {
      let n = 0;
      try {
        const r = await db.execute(sql`
          with stapel as (
            select id from jobs
            where is_demo = false and latitude is null
              and location = ${String(o.location)} and country = ${String(o.country)}
            limit 2000
            for update skip locked
          )
          update jobs set latitude = ${k.lat}, longitude = ${k.lon}
          from stapel where jobs.id = stapel.id`);
        n = r.rowCount ?? 0;
      } catch {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      geschrieben += n;
      if (n === 0) break;
    }
  }
  if ((i + 1) % 25 === 0 || i + 1 === orte.length) {
    console.log(
      `  ${String(i + 1).padStart(4)}/${orte.length} · ${gefunden} aufgelöst, ${ohne} ohne · ` +
      `${geschrieben.toLocaleString("de-DE")} Stellen · ${((Date.now()-t0)/60000).toFixed(1)} min`,
    );
  }
  /* Nominatim: eine Anfrage je Sekunde. Der Zwischenspeicher fängt
     Wiederholungen ab, deshalb nur pausieren, wenn wirklich gefragt wurde. */
  await new Promise((r) => setTimeout(r, 1100));
}

const stand = (await db.execute(sql`
  select count(*)::int gesamt, count(latitude)::int mit from jobs where is_demo=false`)).rows[0];
console.log(`\n${Number(stand.mit).toLocaleString("de-DE")} von ${Number(stand.gesamt).toLocaleString("de-DE")} Stellen mit Koordinaten (${(100*stand.mit/stand.gesamt).toFixed(1)} %)`);
process.exit(0);
