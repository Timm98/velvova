import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { ReedAdapter } = await import("../packages/jobs/src/sources/reed.ts");
const { UsaJobsAdapter } = await import("../packages/jobs/src/sources/usajobs.ts");
const { FindworkAdapter } = await import("../packages/jobs/src/sources/findwork.ts");
const { wegBerechnen, verfuegbareModi } = await import("../apps/web/src/lib/geo/anbieter.ts");

for (const [name, a] of [
  ["Reed", new ReedAdapter()],
  ["USAJOBS", new UsaJobsAdapter()],
  ["Findwork", new FindworkAdapter()],
]) {
  try {
    const l = await a.fetchListings({ limit: 10 });
    const mitGehalt = l.filter((x) => x.salaryMin != null || x.salaryMax != null).length;
    const text = Math.round(l.reduce((s, x) => s + (x.description ?? "").length, 0) / Math.max(1, l.length));
    console.log(`  ok   ${name.padEnd(10)} ${l.length} Anzeigen · ${mitGehalt} mit Gehalt · Ø ${text} Zeichen`);
    if (l[0]) console.log(`       „${String(l[0].title).slice(0, 46)}" — ${String(l[0].companyName).slice(0, 26)}`);
  } catch (e) {
    console.log(`  !!   ${name.padEnd(10)} ${String(e instanceof Error ? e.message : e).slice(0, 110)}`);
  }
}

console.log(`\nArbeitsweg — verfügbare Verkehrsmittel: ${verfuegbareModi().join(", ")}`);
const von = { lat: 49.0094, lon: 8.4017 }, nach = { lat: 48.7841, lon: 9.1829 };
for (const m of verfuegbareModi()) {
  const w = await wegBerechnen(von, nach, m);
  console.log(`  ${m.padEnd(8)} ${w ? `${w.minuten} Min · ${w.kilometer} km` : "keine Route"}`);
}
process.exit(0);
