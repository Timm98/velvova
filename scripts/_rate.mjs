import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { BundesagenturAdapter } = await import("../packages/jobs/src/sources/bundesagentur.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");
const { berufsabfragen } = await import("../packages/jobs/src/berufsabfragen.ts");
// Berufe vom Ende des Wortschatzes — die hat der laufende Import noch nicht.
const alle = await berufsabfragen(400);
const r = await ingestFromAdapter(
  new BundesagenturAdapter({ abfragen: alle.slice(-25), pauseMs: 100, gleichzeitig: 4 }),
  { limit: 600 },
);
console.log(`neu ${r.inserted} · unverändert ${r.unchanged} · geändert ${r.updated} · zusammengeführt ${r.merged} · Fehler ${r.failed}`);
for (const e of r.errors.slice(0, 3)) console.log("  !", e);
process.exit(0);
