import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { oeffentlicheSuche } = await import("../apps/web/src/lib/jobs/oeffentliche-suche.ts");
for (const p of [
  { q: "Pflegefachkraft", ort: "Berlin" },
  { q: "Softwareentwickler" },
  { ort: "Karlsruhe" },
  { q: "Lagerhelfer", ort: "München", land: "DE" },
  {},
]) {
  const t0 = Date.now();
  const r = await oeffentlicheSuche(p);
  const wie = r.mehrAls ? `über ${r.anzahl}` : String(r.anzahl);
  console.log(`${JSON.stringify(p).padEnd(52)} ${String(Date.now()-t0).padStart(6)} ms · ${wie.padStart(10)} Treffer · weiter: ${r.hatWeitere}`);
  if (r.treffer[0]) console.log(`    ${r.treffer[0].titel.slice(0,52)} | ${r.treffer[0].unternehmen.slice(0,26)} | ${r.treffer[0].ort.slice(0,26)}`);
}
process.exit(0);
