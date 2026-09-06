import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Alles, was Jooble für die Fehlersuche erfragt hat — gemessen, nicht
 * behauptet. Der Schlüssel wird nirgends ausgegeben.
 */
const key = process.env.JOOBLE_API_KEY_DE ?? process.env.JOOBLE_API_KEY;
if (!key) { console.log("kein Schlüssel hinterlegt"); process.exit(1); }
const maskiert = `${key.slice(0, 4)}…${key.slice(-2)} (${key.length} Zeichen)`;

console.log("1) Ausgehende IP");
for (const dienst of ["https://api.ipify.org", "https://ifconfig.me/ip"]) {
  try {
    const r = await fetch(dienst, { signal: AbortSignal.timeout(8000) });
    console.log(`   ${dienst}: ${(await r.text()).trim()}`);
  } catch (e) { console.log(`   ${dienst}: nicht erreichbar`); }
}

console.log("\n2) User-Agent, den Node von sich aus sendet");
try {
  const r = await fetch("https://httpbin.org/user-agent", { signal: AbortSignal.timeout(8000) });
  console.log("   ", (await r.text()).trim());
} catch { console.log("    httpbin nicht erreichbar"); }

console.log("\n3) Der Aufruf, wie unser Code ihn macht");
const koerper = { keywords: "Kundenbetreuung Sachbearbeitung Vertrieb Logistik", location: "Deutschland", page: "1" };
console.log(`   POST https://jooble.org/api/${maskiert}`);
console.log("   Header: Content-Type: application/json  (kein eigener User-Agent)");
console.log("   Körper:", JSON.stringify(koerper));

const t0 = Date.now();
const antwort = await fetch(`https://jooble.org/api/${key}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(koerper),
  signal: AbortSignal.timeout(20000),
}).catch((e) => ({ fehler: String(e) }));

if (antwort.fehler) { console.log("   Netzfehler:", antwort.fehler); process.exit(0); }

console.log(`\n4) Antwort nach ${Date.now() - t0} ms`);
console.log(`   Status: ${antwort.status} ${antwort.statusText}`);
console.log("   Header:");
for (const [k, v] of antwort.headers.entries()) console.log(`     ${k}: ${String(v).slice(0, 120)}`);
const text = await antwort.text();
console.log(`   Körper (${text.length} Zeichen):`);
console.log("   " + text.replace(/\s+/g, " ").slice(0, 500));
