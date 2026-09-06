import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { BundesagenturAdapter } = await import("../packages/jobs/src/sources/bundesagentur.ts");
const a = new BundesagenturAdapter({ abfragen: ["Erzieher","Koch","Pflegefachkraft","Elektroniker","Verkäufer","Buchhalter"], pauseMs: 60 });
const l = await a.fetchListings({ limit: 400 });
console.log("geholt:", l.length);
const zahlfelder = ["salaryMin","salaryMax","weeklyHours","remotePercent","travelPercent","descriptionLength"];
let auffaellig = 0;
for (const x of l) {
  for (const f of zahlfelder) {
    const v = x[f];
    if (v === undefined || v === null) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) {
      console.log(`  ${x.externalId}: ${f} = ${JSON.stringify(v)} (${typeof v})`);
      auffaellig++;
    }
  }
}
console.log("auffällige Felder:", auffaellig);
process.exit(0);
