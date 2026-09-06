/**
 * Welche Anbieter einsatzbereit sind — ohne einen einzigen Netzzugriff.
 *
 *   node scripts/provider-status.mjs
 */
process.loadEnvFile?.(".env.local");
const { anbieterStand } = await import("../packages/jobs/src/index.ts");
const stand = anbieterStand();

/*
 * Der Unterschied, der hier ausdrücklich dastehen muss.
 *
 * Dieses Skript fragt niemanden — es liest Konfiguration. „active"
 * heisst deshalb „eingerichtet und freigegeben", nicht „antwortet".
 * Jooble stand hier auf active und wies jede Anfrage mit 403 ab; wer
 * die Zeile ohne diesen Hinweis liest, hält den Anbieter für
 * einsatzbereit und sucht den Fehler danach überall sonst.
 */
console.log("Zustand = Konfiguration, nicht Erreichbarkeit.");
console.log("Ob ein Anbieter wirklich antwortet: node scripts/provider-smoketest.mjs\n");
const breite = Math.max(...stand.map((s) => s.name.length));
for (const s of stand) {
  console.log(`${s.name.padEnd(breite)}  ${s.zustand}${s.hinweis ? `  — ${s.hinweis}` : ""}`);
}
console.log(`\n${stand.filter((s) => s.zustand === "active").length}/${stand.length} einsatzbereit`);

/*
 * Zwei Variablen mit demselben Wert.
 *
 * Der häufigste Konfigurationsfehler und der am schwersten zu sehende:
 * beim Ausfüllen untereinanderstehender Felder wandert ein Wert eine
 * Zeile zu weit. Es fiel hier tatsächlich an: in
 * BRIGHT_DATA_DATASET_ID stand der API-Schlüssel, und der Abruf
 * scheiterte danach mit einem nackten 404 — die Suche ging zur
 * Schnittstelle statt zur Konfiguration.
 *
 * Verglichen werden Hashes. Der Wert selbst wird nie ausgegeben.
 */
const crypto = await import("node:crypto");
const NAMEN = [
  "JOOBLE_API_KEY", "BRIGHT_DATA_API_KEY", "BRIGHT_DATA_DATASET_ID",
  "ADZUNA_APP_ID", "ADZUNA_APP_KEY", "THEIRSTACK_API_KEY",
  "RAPIDAPI_KEY", "CORESIGNAL_API_KEY", "APIFY_TOKEN", "OPENAI_API_KEY",
];
const gesehen = new Map();
const doppelt = [];
for (const n of NAMEN) {
  const v = process.env[n];
  if (!v) continue;
  const f = crypto.createHash("sha256").update(v).digest("hex");
  if (gesehen.has(f)) doppelt.push([gesehen.get(f), n]);
  else gesehen.set(f, n);
}
if (doppelt.length > 0) {
  console.log("\nAchtung — gleicher Wert in zwei Variablen:");
  for (const [a, b] of doppelt) console.log(`  ${a} und ${b} sind identisch. Das ist fast nie beabsichtigt.`);
}
