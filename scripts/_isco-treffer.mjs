import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/**
 * Trifft ein Stellentitel seine ISCO-Gruppe über die Beispielberufe?
 *
 * Stichprobe echter Titel, gegen die Volltextsuche gehalten. Erst
 * messen, dann bauen.
 */
const proben = (await db.execute(sql`
  select title, kldb from jobs tablesample system (1)
  where country = 'DE' and title is not null limit 25`)).rows;

let treffer = 0;
for (const p of proben) {
  /*
   * Den Titel auf seine Berufswörter zurückschneiden.
   *
   * „Werkstudent:in Founders Associate (m/w/d) - Vollzeit" enthält
   * drei Dinge, die nichts über den Beruf sagen: die Anrede-Klammer,
   * die Beschäftigungsart und die Auszeichnung. Was übrig bleibt,
   * sind die Wörter, die eine Berufsgruppe treffen können.
   */
  const gesaeubert = String(p.title)
    .replace(/\((?:[mwdfx*\/\s:.-]+)\)/gi, " ")
    .replace(/\b(m\/w\/d|w\/m\/d|m\/f\/d|gn|all genders)\b/gi, " ")
    .replace(/\b(vollzeit|teilzeit|minijob|aushilfe|ausbildung|praktikant\w*|werkstudent\w*|senior|junior|leitung)\b/gi, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .slice(0, 4);
  if (gesaeubert.length === 0) { console.log(`${String(p.title).slice(0,44).padEnd(46)} — nichts übrig`); continue; }
  const anfrage = gesaeubert.map((w) => w.toLowerCase() + ":*").join(" | ");
  const [r] = (await db.execute(sql`
    select code, beruf_de,
           ts_rank(to_tsvector('german', beispielberufe || ' ' || beruf_de),
                   to_tsquery('german', ${anfrage})) rang
    from isco_berufe
    where to_tsvector('german', beispielberufe || ' ' || beruf_de)
          @@ to_tsquery('german', ${anfrage})
    order by rang desc limit 1`)).rows;
  if (r) treffer++;
  console.log(`${String(p.title).slice(0, 44).padEnd(46)} ${r ? `${r.code} ${String(r.beruf_de).slice(0,28)}` : "— kein Treffer"}`);
}
console.log(`\n${treffer} von ${proben.length} Titeln zugeordnet`);
