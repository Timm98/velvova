import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Gibt es eine Quelle, die wir durchsuchen dürfen, aber nicht anzeigen?
 *
 * `canPublish` prüft genau das — und hat keinen Aufrufer. Bevor ich
 * ein Gate einbaue, will ich wissen, ob es je zuschlagen würde.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { decideForProvider, isAllowed } = await import("../packages/sources/src/index.ts");
const db = await getDb();

const quellen = (await db.execute(sql`
  select key, display_name, kind, license_status, enabled from job_sources order by key`)).rows;

let heikel = 0;
for (const q of quellen) {
  let e;
  try { e = decideForProvider(q.key); } catch { console.log(`${q.key.padEnd(20)} keine Entscheidung hinterlegt`); continue; }
  const suchen = isAllowed(e, "Search");
  const zeigen = isAllowed(e, "PublicDisplay");
  const flagge = suchen && !zeigen ? "  ← durchsuchbar, nicht anzeigbar" : "";
  if (flagge) heikel++;
  if (q.enabled || flagge) {
    console.log(`${String(q.key).padEnd(20)} ${q.enabled ? "aktiv " : "aus   "} such:${suchen ? "ja " : "nein"} zeig:${zeigen ? "ja " : "nein"} ${e.reasonCode ?? ""}${flagge}`);
  }
}
console.log(`\n${heikel} Quellen mit Anzeige-Verbot bei erlaubter Suche`);
