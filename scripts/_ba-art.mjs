import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const url = new URL("https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs");
url.searchParams.set("was", "Buchhaltung");
url.searchParams.set("size", "25");
url.searchParams.set("page", "1");
const r = await fetch(url, { headers: { "X-API-Key": "jobboerse-jobsuche" } });
const j = await r.json();
const liste = j.stellenangebote ?? j.ergebnisliste ?? [];
console.log("  verguetungsangabe → gehaltsspanne (wie die Quelle es liefert):");
for (const s of liste) {
  if (s.gehaltsspanneVon == null && s.gehaltsspanneBis == null) continue;
  console.log(`    ${String(s.verguetungsangabe ?? "—").padEnd(16)} ${String(s.gehaltsspanneVon ?? "–")}–${String(s.gehaltsspanneBis ?? "–")}   ${String(s.stellenangebotsTitel ?? "").slice(0, 40)}`);
}
process.exit(0);
