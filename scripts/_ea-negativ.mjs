/** Welche negativen Kennzahlen benutzt der Entgeltatlas? */
const K = { "X-API-Key": "infosysbub-ega", Accept: "application/json", "User-Agent": "Paycheck/1.0" };
const B = "https://rest.arbeitsagentur.de/infosysbub/entgeltatlas/pc/v1/entgelte";
const zaehler = new Map();
let saetze = 0, mitEntgelt = 0;
const berufe = ["71304", "43414", "81104", "25102", "62102", "51102", "83112", "72104"];
for (const b of berufe) {
  for (const l of ["1", "2", "3", "4"]) {
    const r = await fetch(`${B}/${b}?l=${l}`, { headers: K, signal: AbortSignal.timeout(20000) });
    if (!r.ok) continue;
    for (const e of await r.json()) {
      saetze++;
      if (e.entgelt > 0) mitEntgelt++;
      for (const f of ["entgelt", "entgeltQ25", "entgeltQ75", "besetzung"]) {
        const v = e[f];
        if (typeof v === "number" && v < 0) zaehler.set(`${f} = ${v}`, (zaehler.get(`${f} = ${v}`) ?? 0) + 1);
      }
    }
    await new Promise((x) => setTimeout(x, 200));
  }
}
console.log(`${saetze} Sätze, davon ${mitEntgelt} mit positivem Entgelt (${(100*mitEntgelt/saetze).toFixed(0)} %)\n`);
console.log("Negative Werte:");
for (const [k, n] of [...zaehler].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(22)} ${n}×`);
process.exit(0);
