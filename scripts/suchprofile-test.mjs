/**
 * Vier Suchprofile gegen die echten Anbieter.
 *
 * Kleine Limits — es geht um „findet die Kette etwas Sinnvolles",
 * nicht um Menge. Jeder Satz kostet Kontingent.
 *
 * Profil D ist der eigentliche Prüfstein: kein Jobtitel, nur
 * Eigenschaften. Wer darauf mit „Quereinstieg" als Suchwort antwortet,
 * betreibt Wortabgleich. Gefragt sind Tätigkeitsmuster.
 *
 *   node scripts/suchprofile-test.mjs
 */
process.loadEnvFile?.(".env.local");
const { TheirStackAdapter, JSearchAdapter, fuehreZusammen } = await import("../packages/jobs/src/index.ts");

const PROFILE = [
  { name: "A — Karlsruhe, Büro/Operations, hybrid, 45k+",
    titel: ["Sachbearbeitung", "Büromanagement", "Operations"], such: ["Sachbearbeitung Karlsruhe", "Büromanagement Karlsruhe"], orte: ["Karlsruhe"] },
  { name: "B — Berlin, Marketing, remote",
    titel: ["Marketing Manager", "Online Marketing"], such: ["Marketing Berlin remote"], orte: ["Berlin"] },
  { name: "C — München, Finance, Vollzeit",
    titel: ["Finanzbuchhaltung", "Controlling"], such: ["Controlling München"], orte: ["München"] },
  { name: "E — Software Developer, Hamburg, hybrid",
    titel: ["Software Developer", "Softwareentwickler", "Backend Developer"],
    such: ["Software Developer Hamburg", "Softwareentwickler Hamburg"], orte: ["Hamburg"] },
  { name: "D — Quereinstieg, kundenorientiert, wenig körperlich",
    /*
     * Kein Jobtitel im Profil — also müssen die Suchrichtungen aus den
     * Eigenschaften entstehen. Genau diese Ableitung ist der
     * Unterschied zu einer Jobbörse.
     */
    titel: ["Customer Success", "Kundenbetreuung", "Disposition", "Inside Sales", "Service Koordination", "Auftragsabwicklung"],
    such: ["Customer Success Quereinstieg", "Kundenbetreuung Büro"] },
];

for (const p of PROFILE) {
  const eingang = [];
  const berichte = [];

  for (const [name, adapter, opt] of [
    ["theirstack", new TheirStackAdapter({ titel: p.titel, orte: p.orte ?? [] }), {}],
    ["jsearch", new JSearchAdapter({ abfragen: p.such }), {}],
  ]) {
    if (!adapter.isConfigured()) { berichte.push(`${name}: nicht eingerichtet`); continue; }
    const t0 = Date.now();
    try {
      const l = await adapter.fetchListings({ limit: 10, ...opt });
      berichte.push(`${name}: ${l.length} in ${Date.now() - t0} ms`);
      for (const x of l) eingang.push({ provider: name, herkunft: "aggregator", listing: x,
        domain: typeof x.raw?.companyDomain === "string" ? x.raw.companyDomain : null });
    } catch (e) {
      berichte.push(`${name}: FEHLER ${e?.status ?? ""} ${String(e.message).slice(0, 90)}`);
    }
  }

  const t0 = Date.now();
  const zusammen = fuehreZusammen(eingang);
  const dedupMs = Date.now() - t0;
  console.log(`\n${p.name}`);
  console.log(`  ${berichte.join(" · ")}`);
  console.log(`  roh ${eingang.length} → eindeutig ${zusammen.length} · ${eingang.length - zusammen.length} Dubletten · Zusammenführung ${dedupMs} ms`);
  const titel = [...new Set(zusammen.map((z) => z.listing.title))];
  for (const t of titel.slice(0, 6)) console.log(`    ${t.slice(0, 78)}`);
}
console.log("");
