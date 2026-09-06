import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { oeffentlicheSuche } = await import("../apps/web/src/lib/jobs/oeffentliche-suche.ts");
for (const land of ["SG","NL","ZA","GB"]) {
  const r = await oeffentlicheSuche({ land });
  console.log(`${land}: ${r.treffer.slice(0,3).map(t=>t.ort).join(" · ")}`);
}
process.exit(0);
