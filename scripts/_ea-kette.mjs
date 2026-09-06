/** DKZ-Beruf → KldB → Entgelt. Die ganze Kette an einem Beispiel. */
const K = { "X-API-Key": "infosysbub-ega", Accept: "*/*", "User-Agent": "Paycheck/1.0" };
const hole = async (u) => {
  const r = await fetch(u, { headers: K, signal: AbortSignal.timeout(25000) });
  return r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status} bei ${u}`));
};
const d = await hole("https://rest.arbeitsagentur.de/infosysbub/dkz-rest/pc/v1/berufe?page=1&size=5");
for (const b of d._embedded.berufe) {
  const kldb = String(b.kldb2010 ?? "").replace(/\D/g, "");
  if (!kldb) { console.log(`${b.kurzBezeichnungNeutral}: keine KldB`); continue; }
  try {
    const e = await hole(`https://rest.arbeitsagentur.de/infosysbub/entgeltatlas/pc/v1/entgelte/${kldb}?l=3`);
    const echt = e.filter((x) => x.entgelt > 0);
    const g = echt.find((x) => x.region?.schluessel === "D" && x.branche?.id === 1 && x.gender?.id === 1);
    console.log(
      `${String(b.kurzBezeichnungNeutral).padEnd(34)} kldb ${kldb}  ` +
      `${echt.length}/${e.length} Sätze mit Wert  ` +
      `Median ${g ? `${g.entgelt} €/Monat → ${(g.entgelt * 12).toLocaleString("de-DE")} €/Jahr` : "—"}`,
    );
  } catch (err) {
    console.log(`${String(b.kurzBezeichnungNeutral).padEnd(34)} kldb ${kldb}  ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 250));
}
process.exit(0);
