import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
const eine = async () => {
  const u = new URL("https://api.adzuna.com/v1/api/jobs/de/search/1");
  u.searchParams.set("app_id", id); u.searchParams.set("app_key", key);
  u.searchParams.set("results_per_page", "50"); u.searchParams.set("content-type", "application/json");
  const r = await fetch(u, { signal: AbortSignal.timeout(20000) }).catch(() => null);
  return r?.status ?? 0;
};
/* Ein Strom, eine Anfrage je Sekunde — so zahm wie möglich. */
let ok = 0, ged = 0;
for (let i = 0; i < 40; i++) {
  const s = await eine();
  if (s === 200) ok++; else if (s === 429) ged++;
  await new Promise((r) => setTimeout(r, 1000));
}
console.log(`  Ein Strom, 1 Anfrage/s über 40 s: ${ok} ok · ${ged} gedrosselt`);
console.log(`  → ${ok >= 35 ? "Kontingent erholt" : ged > 20 ? "weiterhin gesperrt" : "teilweise"}`);
if (ok > 0) console.log(`  Hochgerechnet: ${(ok/40*50*3600).toLocaleString("de-DE")} Anzeigen je Stunde bei diesem Tempo`);
process.exit(0);
