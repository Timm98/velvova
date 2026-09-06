/**
 * Nur die Bundesagentur neu einlesen — für den Gehaltsnachtrag.
 *
 * Gezielt statt alles: Die anderen Quellen sind unverändert, und ein
 * vollständiger Lauf kostet bei den bezahlten Anbietern Geld für nichts.
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { BundesagenturAdapter, ingestFromAdapter } = await import("../packages/jobs/src/index.ts");
const { decideForProvider } = await import("../packages/sources/src/index.ts");

const a = new BundesagenturAdapter();
const p = decideForProvider("bundesagentur");
console.log(`  Freigabe: ${p.decision}`);
const r = await ingestFromAdapter(a, { limit: 250, policy: p });
console.log(`  geholt: ${r.fetched ?? "?"} · neu: ${r.inserted ?? "?"} · aktualisiert: ${r.updated ?? "?"}`);
process.exit(0);
