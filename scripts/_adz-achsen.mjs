import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
const r = await fetch(`https://api.adzuna.com/v1/api/jobs/us/categories?app_id=${id}&app_key=${key}&content-type=application/json`,
  { signal: AbortSignal.timeout(20000) });
const d = await r.json();
const k = d.results ?? [];
console.log(`Kategorien (us): ${k.length}`);
for (const x of k.slice(0, 8)) console.log(`  ${x.tag.padEnd(30)} ${x.label}`);
console.log("\nWie viele Anzeigen je Kategorie?");
let summe = 0;
for (const x of k.slice(0, 6)) {
  const u = new URL(`https://api.adzuna.com/v1/api/jobs/us/search/1`);
  u.searchParams.set("app_id", id); u.searchParams.set("app_key", key);
  u.searchParams.set("results_per_page", "1"); u.searchParams.set("category", x.tag);
  u.searchParams.set("content-type", "application/json");
  const a = await fetch(u, { signal: AbortSignal.timeout(20000) }).catch(() => null);
  const j = a?.ok ? await a.json() : null;
  const n = j?.count ?? 0; summe += n;
  console.log(`  ${x.tag.padEnd(30)} ${Number(n).toLocaleString("de-DE").padStart(10)}`);
  await new Promise((x) => setTimeout(x, 350));
}
console.log(`\nErreichbar je Kategorie: höchstens 5.000 (Seite 100 × 50).`);
console.log(`Bei ${k.length} Kategorien × 19 Ländern: ${(k.length*19*5000).toLocaleString("de-DE")} theoretisch.`);
process.exit(0);
