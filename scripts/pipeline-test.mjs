/**
 * Die ganze Kette einmal durch — mit echten Anbietern.
 *
 * Kleines Limit: es geht um „funktioniert die Kette", nicht um Menge.
 * Jeder Satz kostet Kontingent.
 *
 *   node scripts/pipeline-test.mjs
 */
process.loadEnvFile?.(".env.local");
const { rufeAlleAb, abrufSatz } = await import("../packages/jobs/src/index.ts");

const start = Date.now();
const e = await rufeAlleAb({ limit: 10, genugAb: 40 });

console.log("\n══════ DURCHLAUF ══════\n");
for (const b of e.berichte) {
  console.log(`  ${b.ok ? "ok " : "!! "} ${b.provider.padEnd(22)} ${String(b.stellen).padStart(3)} Stellen · ${b.dauerMs} ms`);
  if (b.fehler) console.log(`        ${b.fehler.slice(0, 150)}`);
}

console.log(`\n${abrufSatz(e)}`);
console.log(`Gesamtdauer: ${Date.now() - start} ms\n`);

const mehrfach = e.stellen.filter((s) => s.quellen.length > 1);
if (mehrfach.length > 0) {
  console.log("Von mehreren Anbietern gefunden:");
  for (const s of mehrfach.slice(0, 5)) {
    console.log(`  „${s.listing.title.slice(0, 60)}" — ${s.quellen.map((q) => q.provider).join(" + ")} (über ${s.erkanntUeber})`);
  }
  console.log("");
}

console.log("Beispiele:");
for (const s of e.stellen.slice(0, 5)) {
  const g = s.listing.salaryMin ? `${s.listing.salaryMin}–${s.listing.salaryMax ?? "?"}` : "kein Gehalt";
  console.log(`  ${s.listing.title.slice(0, 55).padEnd(55)} ${s.listing.companyName.slice(0, 22).padEnd(22)} ${g}  [${s.herkunft}]`);
}
console.log("");
