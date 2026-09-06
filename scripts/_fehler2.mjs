import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { BundesagenturAdapter } = await import("../packages/jobs/src/sources/bundesagentur.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");
const { berufsabfragen } = await import("../packages/jobs/src/berufsabfragen.ts");
// Die volle Ursache steht in error.cause — die Meldung von Drizzle ist nur die Abfrage.
const echt = Error.prototype.toString;
const r = await ingestFromAdapter(
  new BundesagenturAdapter({ abfragen: await berufsabfragen(120) }), { limit: 500 });
console.log(`geholt ${r.fetched} · neu ${r.inserted} · fehlerhaft ${r.failed}`);
process.exit(0);
