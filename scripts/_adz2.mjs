import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { AdzunaAdapter } = await import("../packages/jobs/src/sources/adzuna.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");
const r = await ingestFromAdapter(new AdzunaAdapter(), { limit: 500 });
console.log(`geholt ${r.fetched} · neu ${r.inserted} · unverändert ${r.unchanged} · fehlerhaft ${r.failed}`);
for (const e of r.errors.slice(0, 2)) console.log("  !", e.slice(0, 160));
process.exit(0);
