import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Adzuna über Kategorie MAL Ort — die zweite Multiplikation.
 *
 * ── Warum die Kategorienachse allein nicht reicht ─────────────
 *
 * Je Abfrage sind höchstens 5.000 Anzeigen erreichbar; ab Seite 100
 * wiederholen sich die Ergebnisse. Dreissig Kategorien bringen also
 * 150.000 je Land — von 6,7 Millionen amerikanischen Anzeigen sind
 * das 2 %.
 *
 * Ein Ort beginnt die Zählung erneut. Zwanzig Städte mal dreissig
 * Kategorien ergeben 3 Millionen je Land statt 150.000.
 *
 * ── Warum die Reihenfolge Ort vor Kategorie ist ───────────────
 *
 * Wird der Lauf abgebrochen — und er wird abgebrochen, Adzuna
 * drosselt —, ist eine Stadt vollständig besser als dreissig Städte
 * angefangen. Die grösste Stadt zuerst, dort stehen die meisten
 * Anzeigen.
 *
 * Aufruf: node --experimental-strip-types scripts/adzuna-orte.mjs [land]
 */
const { AdzunaAdapter } = await import("../packages/jobs/src/sources/adzuna.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/* Die grössten Arbeitsmärkte je Land, absteigend. */
const ORTE = {
  de: ["Berlin","München","Hamburg","Köln","Frankfurt am Main","Stuttgart","Düsseldorf","Leipzig",
       "Hannover","Nürnberg","Dortmund","Essen","Bremen","Dresden","Karlsruhe","Mannheim","Münster","Augsburg"],
  us: ["New York","Los Angeles","Chicago","Houston","Phoenix","Philadelphia","San Antonio","San Diego",
       "Dallas","Austin","Seattle","Denver","Boston","Atlanta","Miami","Washington","Detroit","Minneapolis"],
  gb: ["London","Birmingham","Manchester","Leeds","Glasgow","Liverpool","Bristol","Sheffield",
       "Edinburgh","Cardiff","Nottingham","Leicester","Newcastle","Southampton"],
  fr: ["Paris","Marseille","Lyon","Toulouse","Nice","Nantes","Strasbourg","Montpellier","Bordeaux","Lille","Rennes"],
  it: ["Roma","Milano","Napoli","Torino","Palermo","Genova","Bologna","Firenze","Bari","Catania"],
  es: ["Madrid","Barcelona","Valencia","Sevilla","Zaragoza","Málaga","Bilbao","Murcia"],
  nl: ["Amsterdam","Rotterdam","Den Haag","Utrecht","Eindhoven","Groningen","Tilburg"],
  pl: ["Warszawa","Kraków","Łódź","Wrocław","Poznań","Gdańsk","Katowice"],
  ca: ["Toronto","Montreal","Vancouver","Calgary","Ottawa","Edmonton","Winnipeg"],
  au: ["Sydney","Melbourne","Brisbane","Perth","Adelaide","Canberra"],
  br: ["São Paulo","Rio de Janeiro","Brasília","Belo Horizonte","Salvador","Curitiba","Porto Alegre"],
  in: ["Bengaluru","Mumbai","Delhi","Hyderabad","Chennai","Pune","Kolkata"],
  mx: ["Ciudad de México","Guadalajara","Monterrey","Puebla","Tijuana"],
  za: ["Johannesburg","Cape Town","Durban","Pretoria"],
  be: ["Brussel","Antwerpen","Gent","Charleroi"],
  at: ["Wien","Graz","Linz","Salzburg","Innsbruck"],
  ch: ["Zürich","Genève","Basel","Bern","Lausanne"],
  sg: ["Singapore"],
  nz: ["Auckland","Wellington","Christchurch"],
};

const land = (process.argv[2] ?? "de").toLowerCase();
const orte = ORTE[land] ?? [];
if (orte.length === 0) { console.error(`Keine Orte für ${land}.`); process.exit(1); }

const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
const r = await fetch(
  `https://api.adzuna.com/v1/api/jobs/${land}/categories?app_id=${id}&app_key=${key}&content-type=application/json`,
  { signal: AbortSignal.timeout(20000) });
if (!r.ok) { console.error(`Kategorien nicht abrufbar: HTTP ${r.status}`); process.exit(1); }
const kategorien = ((await r.json()).results ?? []).map((k) => k.tag);

/*
 * Schätzwert statt count(*).
 *
 * Hier stand eine exakte Zählung über `jobs`. Bei 1,58 Mio. Zeilen und
 * gleichzeitig laufenden Importen bricht sie in die Zeitgrenze — und
 * riss den ganzen Erntelauf mit, bevor eine einzige Anzeige geholt
 * war. So sind die DACH-Läufe gestorben: nicht an Adzuna, sondern an
 * einer Zeile, die nur eine Zahl fürs Protokoll holen wollte.
 *
 * Der Planer-Schätzwert kostet nichts und ist für eine Startmeldung
 * genau genug.
 */
const vorher = Number(
  (await db.execute(sql`select reltuples::bigint n from pg_class where relname = 'jobs'`)).rows[0].n,
);
console.log(`${land.toUpperCase()} · ${orte.length} Orte × ${kategorien.length} Kategorien · Bestand etwa ${vorher.toLocaleString("de-DE")}\n`);

const t0 = Date.now();
let neu = 0, gedrosselt = 0;
for (const ort of orte) {
  let ortNeu = 0;
  for (const k of kategorien) {
    try {
      const e = await ingestFromAdapter(
        new AdzunaAdapter({ country: land, kategorie: k, wo: ort, umkreis: 50 }),
        { limit: 5000 },
      );
      neu += e.inserted;
      ortNeu += e.inserted;
    } catch (e) {
      const t = String(e instanceof Error ? e.message : e);
      if (/429|503/.test(t)) gedrosselt++;
      /*
       * Weitermachen statt abbrechen.
       *
       * Adzuna drosselt einzelne Anfragen, nicht den Zugang. Ein
       * Abbruch bei der ersten Drosselung verschenkte den Rest des
       * Laufs; eine kurze Pause reicht.
       */
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  /* Schätzwert — eine exakte Zählung hier riss den Lauf nach der ersten Stadt ab. */
  const jetzt = Number((await db.execute(sql`select reltuples::bigint n from pg_class where relname = 'jobs'`)).rows[0].n);
  console.log(
    `  ${ort.padEnd(20)} neu ${String(ortNeu).padStart(6)} · gesamt ${String(neu).padStart(7)} · ` +
    `Bestand ${jetzt} · ${gedrosselt} gedrosselt · ${((Date.now()-t0)/60000).toFixed(0)} min`,
  );
}
console.log(`\nFertig: ${neu} neue Stellen aus ${land.toUpperCase()}.`);
process.exit(0);
