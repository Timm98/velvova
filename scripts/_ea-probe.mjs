import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const id = process.env.ENTGELTATLAS_CLIENT_ID?.trim() ?? "";
const geheim = process.env.ENTGELTATLAS_CLIENT_SECRET?.trim() ?? "";
const U = "https://rest.arbeitsagentur.de/infosysbub/entgeltatlas/pc/v1/entgelte/71304?l=4";

const formen = [
  ["X-API-Key = ID",        { "X-API-Key": id }],
  ["X-API-Key = Secret",    { "X-API-Key": geheim }],
  ["X-API-Key = entgeltatlas", { "X-API-Key": "entgeltatlas" }],
  ["Bearer = Secret",       { Authorization: `Bearer ${geheim}` }],
  ["ID + Secret Kopfpaar",  { "X-API-Key": id, "X-Client-Secret": geheim }],
];
for (const [name, kopf] of formen) {
  const r = await fetch(U, {
    headers: { Accept: "application/json", "User-Agent": "Paycheck/1.0", ...kopf },
    signal: AbortSignal.timeout(15000),
  }).catch((e) => ({ status: 0, text: async () => String(e) }));
  const t = await r.text();
  console.log(`${name.padEnd(26)} HTTP ${r.status}  ${t.slice(0, 90).replace(/\s+/g, " ")}`);
  await new Promise((x) => setTimeout(x, 400));
}
process.exit(0);
