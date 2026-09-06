import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { BundesagenturAdapter } = await import("../packages/jobs/src/sources/bundesagentur.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");
const { berufsabfragen } = await import("../packages/jobs/src/berufsabfragen.ts");
const r = await ingestFromAdapter(
  new BundesagenturAdapter({ abfragen: await berufsabfragen(80) }), { limit: 400 });
console.log(`geholt ${r.fetched} · neu ${r.inserted} · fehlerhaft ${r.failed}`);
for (const e of r.errors) {
  const m = /(duplicate key[^"]*|violates [^"]*|value too long[^"]*|null value in column [^"]*|invalid input[^"]*|deadlock[^"]*)/i.exec(e);
  console.log("  ->", (m ? m[1] : e).replace(/\s+/g, " ").slice(0, 200));
}
process.exit(0);
