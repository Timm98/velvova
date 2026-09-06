import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Belege aus dem Verlauf des Arbeitsprofils nachtragen.
 *
 * ── Was hier entsteht ─────────────────────────────────────────
 *
 * Keine neue Aussage über einen Menschen, sondern eine Auszählung
 * dessen, was er selbst über Monate mehrfach gesagt hat. Dieselbe
 * Angabe, dreimal, bei verschiedenen Gelegenheiten, über mindestens
 * sechzig Tage — das ist die einzige Belegstufe, die durch blosses
 * Warten entsteht und die niemand für ein Bewerbungsgespräch
 * herstellen kann.
 *
 * ── Warum als Lauf und nicht beim Seitenaufruf ────────────────
 *
 * Es ist ein Schreiber. Im Lesepfad kostet er zwei Rundläufe je
 * Seitenaufruf, und zwei gleichzeitige Aufrufe schrieben dieselbe
 * Zeile doppelt.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { verlaufsbelegeSchreiben } = await import("../apps/web/src/lib/belege.ts");
const db = await getDb();

const nutzer = (await db.execute(sql`
  select distinct user_id from arbeitsprofil`)).rows;
console.log(`${nutzer.length} Nutzer mit Arbeitsprofil`);

let fehler = 0;
for (const n of nutzer) {
  try { await verlaufsbelegeSchreiben(n.user_id); }
  catch { fehler++; }
}
console.log(`fertig · ${fehler} Fehler`);
process.exit(0);
