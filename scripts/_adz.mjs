import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { AdzunaAdapter, ingestFromAdapter } = await import("../packages/jobs/src/index.ts");
const { decideForProvider } = await import("../packages/sources/src/index.ts");
const a = new AdzunaAdapter();
if (!a.isConfigured()) { console.log("  Adzuna nicht eingerichtet — übersprungen."); process.exit(0); }
const p = decideForProvider("adzuna");
const r = await ingestFromAdapter(a, { limit: 120, policy: p });
console.log(`  geholt: ${r.fetched ?? "?"} · neu: ${r.inserted ?? "?"} · aktualisiert: ${r.updated ?? "?"}`);
process.exit(0);
