import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Denselben Wortschatz über verschiedene Filter der Jobbörse holen.
 *
 * ── Wozu ──────────────────────────────────────────────────────
 *
 * Je Suchbegriff gibt die Jobbörse höchstens 10.000 Anzeigen heraus.
 * Mit 3.600 Begriffen wären das rechnerisch 36 Millionen Plätze — und
 * trotzdem standen wir bei 52,7 % ihres Bestands. Die obersten 10.000
 * zu „Elektroniker" überschneiden sich eben stark mit denen zu
 * „Elektroniker Betriebstechnik".
 *
 * Ein Filter beginnt die Zählung von vorn. Gemessen:
 *
 *   ohne Filter        1.012.401
 *   arbeitszeit=vz       840.072
 *   arbeitszeit=tz       225.369
 *   zeitarbeit=false     798.453
 *
 * „Teilzeit" fördert Anzeigen zutage, die ohne Filter unterhalb von
 * Platz 10.000 lagen — und damit unerreichbar waren.
 *
 * Aufruf:
 *   node --experimental-strip-types scripts/bestand-achsen.mjs [achse] [teil] [vonTeilen]
 */
const { BundesagenturAdapter } = await import("../packages/jobs/src/sources/bundesagentur.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");
const { berufsabfragen } = await import("../packages/jobs/src/berufsabfragen.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/** Die Achsen, jede mit eigenem Zählwerk bei der Jobbörse. */
const ACHSEN = {
  teilzeit: { arbeitszeit: "tz" },
  vollzeit: { arbeitszeit: "vz" },
  ohnezeitarbeit: { zeitarbeit: "false" },
  befristet: { befristung: "1" },
  unbefristet: { befristung: "2" },
  // Gemessene Grösse der Teilmengen (scripts/_ba-werte.mjs):
  schicht: { arbeitszeit: "snw" },      // 101.367 — Schicht, Nacht, Wochenende
  minijob: { arbeitszeit: "mj" },       //  24.623
  ausbildung: { angebotsart: "4" },     // 170.141 — unser Wortschatz trifft sie kaum
  praktikum: { angebotsart: "34" },     //  14.680
  selbststaendig: { angebotsart: "2" }, //   3.310
};

const achse = process.argv[2] ?? "teilzeit";
const teil = Number(process.argv[3] ?? 1);
const vonTeilen = Number(process.argv[4] ?? 1);
const zusatz = ACHSEN[achse];
if (!zusatz) {
  console.error(`Unbekannte Achse. Erlaubt: ${Object.keys(ACHSEN).join(", ")}`);
  process.exit(1);
}

const alle = await berufsabfragen(3000);
const berufe = alle.filter((_, i) => i % vonTeilen === teil - 1);
const vorher = (await db.execute(sql`select count(*)::int n from jobs where is_demo=false`)).rows[0].n;
console.log(`Achse „${achse}" (${JSON.stringify(zusatz)}) · ${berufe.length} Begriffe · Bestand ${vorher}\n`);

const t0 = Date.now();
let neu = 0;
for (let i = 0; i < berufe.length; i += 25) {
  const gruppe = berufe.slice(i, i + 25);
  try {
    const r = await ingestFromAdapter(
      new BundesagenturAdapter({ abfragen: gruppe, zusatz, pauseMs: 60, gleichzeitig: 8 }),
      { limit: 3000 },
    );
    neu += r.inserted;
    const jetzt = (await db.execute(sql`select count(*)::int n from jobs where is_demo=false`)).rows[0].n;
    console.log(
      `  ${Math.floor(i / 25) + 1}/${Math.ceil(berufe.length / 25)} · geholt ${String(r.fetched).padStart(5)} · ` +
        `neu ${String(r.inserted).padStart(5)} · Bestand ${jetzt} · ${((Date.now() - t0) / 60000).toFixed(0)} min`,
    );
  } catch (e) {
    console.log(`  ! ${String(e instanceof Error ? e.message : e).slice(0, 90)}`);
  }
}
console.log(`\nFertig: ${neu} neue Stellen über die Achse „${achse}".`);
process.exit(0);
