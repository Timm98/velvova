import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/**
 * Amtliche Berufsnamen gegen ISCO-Beispielberufe.
 *
 * Beide Seiten sind Berufsbezeichnungen, keine Stellentitel — kein
 * „(m/w/d)", keine Beschäftigungsart, keine Werbung.
 */
const proben = (await db.execute(sql`
  select beruf, schluessel from beruf_schluessel
  where schluessel is not null order by random() limit 20`)).rows;

for (const p of proben) {
  const worte = String(p.beruf)
    .replace(/\((?:grundständig|weiterführend|[^)]*)\)/gi, " ")
    .replace(/\/(in|-in|r|e)\b/gi, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/).filter((w) => w.length >= 4).slice(0, 4);
  if (!worte.length) { console.log(`${String(p.beruf).slice(0,38).padEnd(40)} — nichts übrig`); continue; }
  const anfrage = worte.map((w) => w.toLowerCase() + ":*").join(" | ");
  const [r] = (await db.execute(sql`
    select code, beruf_de,
      ts_rank(to_tsvector('german', beispielberufe || ' ' || beruf_de), to_tsquery('german', ${anfrage})) rang
    from isco_berufe
    where to_tsvector('german', beispielberufe || ' ' || beruf_de) @@ to_tsquery('german', ${anfrage})
    order by rang desc limit 1`)).rows;
  console.log(`${String(p.beruf).slice(0,38).padEnd(40)} ${String(p.schluessel).slice(0,2)}  →  ${r ? `${r.code} ${String(r.beruf_de).slice(0,30)}` : "—"}`);
}
