import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { TheirStackAdapter } = await import("../packages/jobs/src/sources/theirstack.ts");
const a = new TheirStackAdapter();
const l = await a.fetchListings({ limit: 25 });   // genau eine Anfrage
console.log(`${l.length} Anzeigen aus einer Anfrage.\n`);
const zaehl = (f) => l.filter(f).length;
console.log(`  mit Gehalt:        ${zaehl(x => x.salaryMin != null || x.salaryMax != null)}`);
console.log(`  mit Wochenstunden: ${zaehl(x => x.weeklyHours != null)}`);
console.log(`  mit Beschreibung:  ${zaehl(x => (x.description ?? "").length > 200)}`);
console.log(`  mit Vertragsart:   ${zaehl(x => x.contractType != null)}`);
console.log(`  remote/hybrid:     ${zaehl(x => x.workModel !== "on_site")}`);
console.log(`  Länder:            ${[...new Set(l.map(x => x.country))].join(", ")}`);
console.log(`  Orte (Auswahl):    ${[...new Set(l.map(x => x.location))].slice(0,5).join(" · ")}`);
console.log("\n  Beispiele:");
for (const x of l.slice(0, 5)) console.log(`   ${String(x.title).slice(0,52).padEnd(54)} ${x.companyName?.slice(0,24)}`);
process.exit(0);
