import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Einen englischen Suchwortschatz aus dem eigenen Bestand ernten.
 *
 * ── Warum ─────────────────────────────────────────────────────
 *
 * Reed, USAJOBS und Findwork blättern ohne Suchbegriff nur durch die
 * ersten Seiten: USAJOBS lieferte 1.755 neue Stellen, dann nur noch
 * Wiederholungen; Reed 985. Mit Begriff beginnt die Zählung von vorn —
 * dieselbe Mechanik wie bei der Bundesagentur, wo 236 Begriffe aus
 * 2.506 Stellen 999.398 erreichbar machten.
 *
 * Der deutsche Wortschatz taugt dafür nicht. „Zerspanungsmechaniker/in"
 * findet in Grossbritannien nichts.
 *
 * ── Woher die Begriffe kommen ─────────────────────────────────
 *
 * Aus den Titeln, die diese Quellen selbst geliefert haben. Ein
 * Stellentitel ist kein Berufsbegriff — „Senior Backend Engineer
 * (m/f/d), Remote" ist zu spezifisch. Deshalb wird auf die tragenden
 * Wörter reduziert und gezählt: Was oft vorkommt, ist ein Beruf; was
 * einmal vorkommt, ist eine Eigenheit.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/** Wörter, die in Titeln stehen und keinen Beruf bezeichnen. */
const FUELL = new Set([
  "senior","junior","lead","principal","staff","head","chief","deputy","assistant",
  "the","and","for","with","our","new","full","part","time","remote","hybrid","onsite",
  "we","are","looking","hiring","join","team","role","position","job","opportunity",
  "level","levels","gs","grade","series","direct","hire","temporary","permanent",
  "m","f","d","w","x","all","genders","fte","phd","msc","bsc",
]);

function begriffe(titel) {
  const worte = String(titel)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !FUELL.has(w));
  const raus = [];
  // Einzelwörter und Paare — „engineer" und „software engineer".
  for (const w of worte) raus.push(w);
  for (let i = 0; i < worte.length - 1; i++) raus.push(`${worte[i]} ${worte[i + 1]}`);
  return raus;
}

const titel = (await db.execute(sql`
  select j.title from jobs j join job_sources s on s.id = j.source_id
  where j.is_demo = false and s.display_name in
    ('USAJOBS (US-Bundesverwaltung)', 'Reed (Grossbritannien)', 'Findwork', 'Arbeitnow')`)).rows;

const zaehl = new Map();
for (const t of titel) for (const b of begriffe(t.title)) zaehl.set(b, (zaehl.get(b) ?? 0) + 1);

/*
 * Mindestens dreimal vorgekommen.
 *
 * Ein Begriff, der einmal auftaucht, ist eine Eigenheit dieser einen
 * Anzeige — ihn zu durchsuchen findet genau sie wieder.
 */
const gut = [...zaehl.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
console.log(`${titel.length} Titel gelesen · ${zaehl.size} Begriffe · ${gut.length} mindestens dreimal`);

let neu = 0;
for (let i = 0; i < gut.length; i += 200) {
  const teil = gut.slice(i, i + 200);
  const werte = sql.join(teil.map(([b, n]) => sql`(${b}, 'englisch', ${n})`), sql`, `);
  const r = await db.execute(sql`
    insert into beruf_wortschatz (beruf, quelle, vorkommen) values ${werte}
    on conflict (beruf) do update set vorkommen = beruf_wortschatz.vorkommen + excluded.vorkommen
    returning (xmax = 0) as war_neu`);
  neu += r.rows.filter((x) => x.war_neu === true || x.war_neu === "t").length;
}
console.log(`${neu} neue Begriffe gespeichert.`);
console.log("Die häufigsten:", gut.slice(0, 12).map(([b]) => b).join(" · "));
process.exit(0);
