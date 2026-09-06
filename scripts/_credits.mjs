import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const k = process.env.CORESIGNAL_API_KEY?.trim();
if (!k) { console.log("kein Schlüssel"); process.exit(0); }
const r = await fetch("https://api.coresignal.com/cdapi/v2/credits/current", {
  headers: { apikey: k, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
console.log(`HTTP ${r.status}:`, (await r.text()).slice(0, 200));
process.exit(0);
