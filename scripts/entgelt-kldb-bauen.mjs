import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die Entgeltwerte an die Berufskennung binden.
 *
 * ── Warum ein exakter Vergleich reicht ────────────────────────
 *
 * `beruf_entgelt` und `beruf_schluessel` stammen beide von der
 * Bundesagentur und benutzen dieselben Berufsbezeichnungen. Gemessen:
 * 1.926 von 1.926 treffen exakt. Ein Textabgleich wäre hier nicht nur
 * überflüssig, sondern schädlich — er würde Treffer erzeugen, wo die
 * Bezeichnungen sich unterscheiden, und damit falsche Gehälter.
 *
 * ── Warum mehrere Kennungen je Beruf zusammenfallen können ────
 *
 * Ein Berufsname kann in `beruf_schluessel` mehrfach stehen, etwa mit
 * verschiedenen Anforderungsniveaus. Dann gilt der Wert für jede
 * dieser Kennungen: Der Entgeltatlas weist ihn ja für diesen Beruf
 * aus, nicht für ein Niveau.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
await db.execute(sql`set statement_timeout = '600s'`);

const r = await db.execute(sql`
  insert into entgelt_kldb (kldb, beruf, q1, median, q3, besetzung, quelle, stand, berechnet_am)
  select left(s.schluessel, 5), min(e.beruf), max(e.q1), max(e.median), max(e.q3),
         max(e.besetzung), min(e.quelle), max(e.stand), now()
  from beruf_entgelt e
  join beruf_schluessel s on lower(s.beruf) = lower(e.beruf)
  where e.median is not null and length(s.schluessel) >= 5
  group by left(s.schluessel, 5)
  on conflict (kldb) do update set
    beruf = excluded.beruf, q1 = excluded.q1, median = excluded.median, q3 = excluded.q3,
    besetzung = excluded.besetzung, quelle = excluded.quelle, stand = excluded.stand,
    berechnet_am = now()
  returning kldb`);
console.log(`${(r.rows ?? []).length} Kennungen mit Entgeltwert`);

const [a] = (await db.execute(sql`
  select count(*)::int n, min(median)::int kleinster, max(median)::int groesster,
         round(avg(besetzung))::int schnitt_besetzung from entgelt_kldb`)).rows;
console.log(`in der Tabelle: ${a.n} · Median von ${a.kleinster?.toLocaleString("de-DE")} bis ${a.groesster?.toLocaleString("de-DE")} € · Ø Besetzung ${a.schnitt_besetzung?.toLocaleString("de-DE")}`);
process.exit(0);
