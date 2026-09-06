import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/** Wie viele Anzeigen jede Quelle überhaupt hergibt. */
const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
const LAENDER = ["gb","us","de","at","ch","nl","fr","it","es","pl","ca","au","br","in","mx","nz","sg","za","be"];

console.log("Adzuna je Land");
let adzuna = 0;
for (const l of LAENDER) {
  const u = new URL(`https://api.adzuna.com/v1/api/jobs/${l}/search/1`);
  u.searchParams.set("app_id", id); u.searchParams.set("app_key", key);
  u.searchParams.set("results_per_page", "1"); u.searchParams.set("content-type", "application/json");
  const r = await fetch(u, { signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!r?.ok) { console.log(`  ${l}  HTTP ${r?.status ?? "—"}`); continue; }
  const d = await r.json();
  const n = d.count ?? 0;
  adzuna += n;
  console.log(`  ${l}  ${Number(n).toLocaleString("de-DE").padStart(10)}`);
  await new Promise((x) => setTimeout(x, 400));
}
console.log(`  Adzuna gesamt: ${adzuna.toLocaleString("de-DE")}\n`);

console.log("Weitere Quellen");
const reed = process.env.REED_API_KEY?.trim();
if (reed) {
  const r = await fetch("https://www.reed.co.uk/api/1.0/search?resultsToTake=1", {
    headers: { Authorization: `Basic ${Buffer.from(`${reed}:`).toString("base64")}` },
    signal: AbortSignal.timeout(20000) }).catch(() => null);
  const d = r?.ok ? await r.json() : null;
  console.log(`  Reed (GB)            ${d ? Number(d.totalResults).toLocaleString("de-DE").padStart(10) : `HTTP ${r?.status ?? "—"}`}`);
}
const usa = process.env.USAJOBS_API_KEY?.trim(), mail = process.env.USAJOBS_EMAIL?.trim();
if (usa) {
  const r = await fetch("https://data.usajobs.gov/api/search?ResultsPerPage=1", {
    headers: { "Authorization-Key": usa, "User-Agent": mail ?? "", Host: "data.usajobs.gov" },
    signal: AbortSignal.timeout(20000) }).catch(() => null);
  const d = r?.ok ? await r.json() : null;
  console.log(`  USAJOBS              ${d ? Number(d.SearchResult?.SearchResultCountAll ?? 0).toLocaleString("de-DE").padStart(10) : `HTTP ${r?.status ?? "—"}`}`);
}
const K = { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "Paycheck/1.0" };
const ba = await (await fetch("https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs?size=1&page=1", { headers: K })).json();
console.log(`  Bundesagentur        ${Number(ba.maxErgebnisse ?? 0).toLocaleString("de-DE").padStart(10)}`);
process.exit(0);
