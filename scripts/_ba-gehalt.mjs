import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { BundesagenturAdapter } = await import("../packages/jobs/src/sources/bundesagentur.ts");
const a = new BundesagenturAdapter({ abfragen: ["Sachbearbeitung", "Buchhaltung", "Disposition"] });
const l = await a.fetchListings({ limit: 60 });
const mit = l.filter((x) => x.salaryMin != null || x.salaryMax != null);
console.log(`  ${l.length} Anzeigen geholt · ${mit.length} mit Gehalt (${Math.round(mit.length/l.length*100)} %)\n`);
for (const j of mit.slice(0, 8)) {
  console.log(`    ${String(j.salaryMin ?? "–")}–${String(j.salaryMax ?? "–")} ${j.salaryCurrency}/${j.salaryPeriod}   ${String(j.title).slice(0, 46)}`);
}
process.exit(0);
