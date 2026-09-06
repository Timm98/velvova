import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die Bestandszahlen der Stellenseite neu auszählen.
 *
 * ── Warum ausserhalb der Seite ────────────────────────────────
 *
 * Die Seite rechnete sie selbst — drei Vollzählungen über `jobs`. Bei
 * 1,58 Mio. Zeilen und laufenden Importen bricht das in die
 * Zeitgrenze, und die Stellenseite antwortete mit 500. Hier darf die
 * Abfrage lange laufen; niemand wartet darauf.
 *
 * ── Warum die Entdopplungszahl fehlt ─────────────────────────
 *
 * Hier stand `count(distinct content_hash)`. Das ist der mit Abstand
 * teuerste Teil — über zwölf Minuten unter Importlast, ohne
 * Ergebnis. Angezeigt wird die Zahl nirgends: Der Satz auf der
 * Stellenseite nennt geprüfte und passende Stellen, und im Trichter
 * steht die Rohzahl. Ein Feld, das eine Vollzählung kostet und das
 * niemand sieht, wird nicht berechnet.
 *
 * Läuft sinnvollerweise stündlich.
 *
 * Aufruf: node --experimental-strip-types scripts/kennzahlen-berechnen.mjs
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

await db.execute(sql`set statement_timeout = '1800s'`);

console.time("gesamt");
const [g] = (await db.execute(sql`
  select
    count(*)::bigint roh,
    count(*) filter (
      where is_demo = false
        and (expires_at is null or expires_at > now())
        and (last_link_check_ok is null or last_link_check_ok = true)
    )::bigint aktiv,
    max(fetched_at) zuletzt
  from jobs`)).rows;
console.timeEnd("gesamt");

await db.execute(sql`
  insert into bestandskennzahlen (quelle, roh, eindeutig, aktiv, zuletzt_geholt, berechnet_am)
  values ('', ${g.roh}, 0, ${g.aktiv}, ${g.zuletzt}, now())
  on conflict (quelle) do update set
    roh = excluded.roh, aktiv = excluded.aktiv,
    zuletzt_geholt = excluded.zuletzt_geholt, berechnet_am = now()`);
console.log(`gesamt ${Number(g.roh).toLocaleString("de-DE")} · aktiv ${Number(g.aktiv).toLocaleString("de-DE")}`);

console.time("je Quelle");
const q = (await db.execute(sql`
  select s.key, count(j.id)::bigint n, max(j.fetched_at) zuletzt
  from job_sources s left join jobs j on j.source_id = s.id
  group by s.key`)).rows;
console.timeEnd("je Quelle");

for (const z of q) {
  await db.execute(sql`
    insert into bestandskennzahlen (quelle, roh, eindeutig, aktiv, zuletzt_geholt, berechnet_am)
    values (${z.key}, ${z.n}, ${z.n}, ${z.n}, ${z.zuletzt}, now())
    on conflict (quelle) do update set
      roh = excluded.roh, zuletzt_geholt = excluded.zuletzt_geholt, berechnet_am = now()`);
}
console.log(`${q.length} Quellen geschrieben`);
process.exit(0);
