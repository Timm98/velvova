import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die Bundesagentur über die Fläche ernten.
 *
 * ── Was gemessen wurde, bevor das hier stand ──────────────────
 *
 * Stichproben von je 100 Anzeigen, gegen den eigenen Bestand gehalten:
 *
 *   Berlin           →   1 unbekannt
 *   seltener Beruf   →   0 unbekannt
 *   Minijob          →   0 unbekannt
 *   Prenzlau         →  30 von 44 unbekannt
 *   Wittenberge      →  62 unbekannt
 *
 * Die fehlenden 233.311 Anzeigen liegen in der Fläche, nicht in den
 * Grossstädten und nicht hinter exotischen Filtern. Ein erster Lauf
 * über die 84 grössten Städte holte 459 Anzeigen aus Berlin und
 * schrieb null neue — die richtige Technik an der falschen Stelle.
 *
 * ── Die Reihenfolge ───────────────────────────────────────────
 *
 * Nach bekannten Anzeigen aufsteigend, aber erst ab einer gewissen
 * Grösse: Orte mit zwei bekannten Anzeigen haben oft auch nur zwei.
 * Der Ertrag liegt bei den mittleren — gross genug für Anzeigen, klein
 * genug, um nie vollständig geholt worden zu sein.
 *
 * `zuletzt_geerntet` und `ertrag` je Ort werden fortgeschrieben. Ein
 * Neustart macht dort weiter, wo der letzte Lauf aufgehört hat, statt
 * von vorn.
 *
 * Aufruf: node --experimental-strip-types scripts/ba-flaeche.mjs
 */
const { BundesagenturAdapter } = await import("../packages/jobs/src/sources/bundesagentur.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");
const { decideForProvider } = await import("../packages/sources/src/index.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const p = decideForProvider("bundesagentur");
const t0 = Date.now();
let neu = 0, orte = 0;

console.log(`Freigabe: ${p.decision} · Ernte über die Fläche\n`);

for (;;) {
  const naechste = (await db.execute(sql`
    select ort, bekannt from ba_ortsliste
    where zuletzt_geerntet is null and bekannt between 5 and 4000
    order by bekannt desc limit 25`)).rows;
  if (naechste.length === 0) {
    console.log("Alle Orte einmal durch.");
    break;
  }

  for (const z of naechste) {
    let ertrag = 0;
    try {
      const e = await ingestFromAdapter(
        /* Ohne Suchbegriff — der Ort ist die Eingrenzung. Ein Begriff
           verengt zusätzlich und kostet Treffer. */
        new BundesagenturAdapter({
          orte: [z.ort],
          abfragen: [""],
          /*
           * Acht gleichzeitig statt vier, Pause 60 statt 120.
           *
           * Beides sind Werte, die der Adapter selbst vorsieht — acht
           * ist seine eigene Obergrenze, und `holJson` staffelt bei
           * 429 und 5xx weiterhin von selbst zurück. Das ist keine
           * Umgehung einer Taktgrenze, sondern die Einstellung, die
           * für einen Bestandslauf gedacht ist.
           *
           * Gemessen bei vier: 1,5 Anzeigen je Sekunde. Für die
           * fehlenden 233.311 wären das über 40 Stunden.
           */
          gleichzeitig: 8,
          pauseMs: 60,
        }),
        { limit: 300, policy: p },
      );
      ertrag = e.inserted ?? 0;
      neu += ertrag;
    } catch (e) {
      console.log(`  ! ${z.ort}: ${String(e instanceof Error ? e.message : e).slice(0, 80)}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
    orte++;
    await db.execute(sql`
      update ba_ortsliste set zuletzt_geerntet = now(), ertrag = ${ertrag} where ort = ${z.ort}`);
    if (orte % 10 === 0) {
      console.log(
        `  ${String(orte).padStart(5)} Orte · neu ${String(neu).padStart(7)} · ` +
        `zuletzt ${z.ort} (+${ertrag}) · ${((Date.now() - t0) / 60000).toFixed(0)} min`,
      );
    }
  }
}
console.log(`\nFertig: ${neu} neue Stellen aus ${orte} Orten.`);
process.exit(0);
