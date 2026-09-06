import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { oeffentlicheSuche } = await import("../apps/web/src/lib/jobs/oeffentliche-suche.ts");
const faelle = [
  { q: "Pflegefachkraft", ort: "Berlin" },
  { q: "Softwareentwickler" },
  { ort: "Karlsruhe" },
  { q: "Lagerhelfer", ort: "München", land: "DE" },
  { q: "Erzieher", ort: "Hamburg" },
  { land: "DE" },
  {},
];
for (const p of faelle) {
  await oeffentlicheSuche(p);                     // aufwaermen
  const t = Date.now(); const r = await oeffentlicheSuche(p);  // messen
  const ms = Date.now() - t;
  const wie = r.mehrAls ? `>${r.anzahl}` : String(r.anzahl);
  console.log(`${(ms + " ms").padStart(8)}  ${wie.padStart(6)}  ${JSON.stringify(p)}`);
}
process.exit(0);
