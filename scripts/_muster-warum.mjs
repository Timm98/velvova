const { BERUFSGRUPPEN } = await import("../apps/web/src/lib/jobs/visuals.ts");
for (const t of ["Wirtschaftsprüfer/in", "Immobilientreuhänder 100%", "Registered Building Inspector",
                 "Mechatroniker (m/w/d)", "Ausbildung zum Augenoptiker", "Diabetesassistentin",
                 "QHSE Officer", "Büroangestellte/r", "Konventioneller Dreher / Rundschleifer"]) {
  const treffer = BERUFSGRUPPEN.filter((g) => g.muster.test(t))
    .map((g) => `${g.key}(${t.match(g.muster)?.[0]})`);
  console.log(`  ${t.padEnd(34)} → ${treffer.join(", ") || "—"}`);
}
process.exit(0);
