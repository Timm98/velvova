import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Amtliche Medianentgelte für jede Berufsbezeichnung unseres Bestands.
 *
 * ── Was das ersetzt ───────────────────────────────────────────
 *
 * `entgelt-sammeln.mjs` bildet Quartile aus den Anzeigen der Jobsuche,
 * die ein Gehalt nennen — eine Stichprobe von zwei Dutzend je Beruf,
 * und nur für 321 der 2.020 Bezeichnungen reichte sie überhaupt.
 *
 * Der Entgeltatlas beruht auf der Beschäftigungsstatistik: alle
 * sozialversicherungspflichtig Beschäftigten, nicht die, deren
 * Stellenanzeige zufällig eine Zahl trug. Wo er etwas ausweist, ist er
 * die bessere Quelle — und er weist für alle 1.302 Berufsgattungen
 * etwas aus, nicht nur für ein Sechstel.
 *
 * ── Wo er es nicht ist ────────────────────────────────────────
 *
 * Liegt der Median an der Beitragsbemessungsgrenze, ist er
 * abgeschnitten: Die Statistik erfasst darüber nichts. Ein solcher
 * Wert überschreibt einen vorhandenen nicht — dann ist die Stichprobe
 * aus echten Anzeigen ehrlicher.
 *
 * Aufruf: node --experimental-strip-types scripts/entgeltatlas-sammeln.mjs
 */
const { amtlicherWert } = await import("../apps/web/src/lib/jobs/entgeltatlas.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/*
 * Je Berufsgattung einmal fragen, nicht je Bezeichnung.
 *
 * Die 2.020 Bezeichnungen verteilen sich auf deutlich weniger
 * Gattungen — „Softwareentwickler/in" und „Anwendungsentwickler/in"
 * tragen dieselbe KldB. Ohne diese Gruppierung fragte der Lauf
 * denselben Wert vielfach ab.
 */
const gattungen = (await db.execute(sql`
  select s.schluessel, min(s.beruf) as beispiel, count(*)::int as bezeichnungen
  from beruf_schluessel s
  where s.schluessel is not null
    and exists (select 1 from beruf_zuordnung z where z.beruf = s.beruf)
  group by s.schluessel
  order by count(*) desc
`)).rows;

console.log(`${gattungen.length} Berufsgattungen zu ${gattungen.reduce((n, g) => n + Number(g.bezeichnungen), 0)} Bezeichnungen\n`);

const t0 = Date.now();
let gefunden = 0, leer = 0, abgeschnitten = 0, zeilen = 0;

for (const [i, g] of gattungen.entries()) {
  const wert = await amtlicherWert(String(g.schluessel)).catch(() => null);
  if (!wert) { leer++; }
  else {
    gefunden++;
    if (wert.abgeschnitten) abgeschnitten++;

    /* Alle Bezeichnungen dieser Gattung bekommen denselben Wert. */
    const namen = (await db.execute(sql`
      select s.beruf from beruf_schluessel s
      where s.schluessel = ${String(g.schluessel)}
        and exists (select 1 from beruf_zuordnung z where z.beruf = s.beruf)
    `)).rows.map((r) => String(r.beruf));

    for (const name of namen) {
      /*
       * Ein abgeschnittener Median überschreibt nichts Vorhandenes.
       * Er darf aber eine leere Zeile füllen — auch ein Wert mit
       * Vorbehalt ist mehr als kein Wert, solange der Vorbehalt
       * mitgeschrieben wird.
       */
      await db.execute(sql`
        insert into beruf_entgelt (beruf, q1, median, q3, anzahl, besetzung, abgeschnitten, quelle, stand)
        values (${name}, ${wert.q1}, ${wert.median}, ${wert.q3},
                ${wert.besetzung ?? 0}, ${wert.besetzung}, ${wert.abgeschnitten},
                'entgeltatlas', now())
        on conflict (beruf) do update set
          q1 = excluded.q1, median = excluded.median, q3 = excluded.q3,
          anzahl = excluded.anzahl, besetzung = excluded.besetzung,
          abgeschnitten = excluded.abgeschnitten, quelle = excluded.quelle, stand = now()
        where beruf_entgelt.quelle = 'entgeltatlas' or not ${wert.abgeschnitten}
      `);
      zeilen++;
    }
  }

  if ((i + 1) % 100 === 0 || i + 1 === gattungen.length) {
    console.log(
      `  ${String(i + 1).padStart(4)}/${gattungen.length} · ` +
      `${gefunden} mit Wert, ${leer} ohne · ${zeilen} Zeilen · ` +
      `${((Date.now() - t0) / 60000).toFixed(1)} min`,
    );
  }
  await new Promise((r) => setTimeout(r, 120));
}

const stand = (await db.execute(sql`
  select quelle, count(*)::int as n, count(q1)::int as mit_q1, count(q3)::int as mit_q3,
         count(*) filter (where abgeschnitten)::int as abgeschnitten
  from beruf_entgelt group by quelle order by n desc`)).rows;
console.log("\nQuelle".padEnd(18), "Zeilen".padStart(8), "mit Q25".padStart(9), "mit Q75".padStart(9), "abgeschn.".padStart(11));
for (const s of stand) {
  console.log(String(s.quelle).padEnd(18), String(s.n).padStart(8), String(s.mit_q1).padStart(9),
    String(s.mit_q3).padStart(9), String(s.abgeschnitten).padStart(11));
}
console.log(`\n${gefunden} von ${gattungen.length} Gattungen mit Wert · ${abgeschnitten} davon abgeschnitten.`);
process.exit(0);
