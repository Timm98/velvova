import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
/** Welche externen Quellen antworten gerade — und welche nicht. */
const proben = [
  ["Bundesagentur Jobsuche", "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs?size=1&page=1",
   { "X-API-Key": "jobboerse-jobsuche" }],
  ["Entgeltatlas", "https://rest.arbeitsagentur.de/infosysbub/entgeltatlas/pc/v1/version",
   { "X-API-Key": "infosysbub-ega" }],
  ["DKZ Berufsverzeichnis", "https://rest.arbeitsagentur.de/infosysbub/dkz-rest/pc/v1/version",
   { "X-API-Key": "infosysbub-ega", Accept: "*/*" }],
  ["job-room.ch", "https://www.job-room.ch/api/jobadvertisements/_search", {}],
  ["EURES", "https://europa.eu/eures/api/public/jv-search/search", {}],
  ["AMS Österreich", "https://jobs.ams.at/public/emps/jobs", {}],
];
for (const [name, url, kopf] of proben) {
  const r = await fetch(url, { headers: { "User-Agent": "Paycheck/1.0", ...kopf },
    signal: AbortSignal.timeout(15000) }).catch(() => null);
  console.log(`  ${name.padEnd(26)} ${r ? `HTTP ${r.status}` : "keine Antwort"}`);
  await new Promise((x) => setTimeout(x, 300));
}
const schluessel = ["ADZUNA_APP_KEY","JOOBLE_API_KEY","REED_API_KEY","USAJOBS_API_KEY",
  "FINDWORK_API_KEY","THEIRSTACK_API_KEY","CORESIGNAL_API_KEY","ORS_API_KEY","EURES_API_KEY",
  "ENTGELTATLAS_CLIENT_ID","BRIGHT_DATA_API_KEY","APIFY_TOKEN","RAPIDAPI_KEY"];
console.log("\nSchlüssel");
for (const s of schluessel) {
  const v = process.env[s]?.trim();
  console.log(`  ${s.padEnd(26)} ${v ? `gesetzt (${v.length})` : "leer"}`);
}
process.exit(0);
