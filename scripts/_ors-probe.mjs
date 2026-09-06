import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const k = process.env.ORS_API_KEY?.trim();
if (!k) { console.log("ORS_API_KEY nicht gesetzt"); process.exit(1); }
console.log(`Schlüssel: ${k.length} Zeichen`);
const r = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
  method: "POST",
  headers: { Authorization: k, "Content-Type": "application/json", Accept: "application/geo+json" },
  body: JSON.stringify({ coordinates: [[13.388, 52.517], [13.397, 52.529]] }),
  signal: AbortSignal.timeout(20000),
});
console.log(`HTTP ${r.status}`);
const t = await r.text();
console.log(t.slice(0, 220).replace(/\s+/g, " "));
process.exit(0);
