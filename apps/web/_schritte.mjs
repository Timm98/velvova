const schritt = async (name, fn) => {
  const t = Date.now();
  try { const r = await fn(); console.log(`  ✓ ${name.padEnd(34)} ${Date.now()-t}ms  ${r ?? ""}`); }
  catch (e) { console.log(`  ✗ ${name.padEnd(34)} ${Date.now()-t}ms  ${String(e).slice(0,180)}`); }
};
await schritt("loadRuntimeConfig", async () => {
  const { loadRuntimeConfig } = await import("@paycheck/config");
  return "Treiber " + loadRuntimeConfig().db.driver;
});
await schritt("getDb", async () => { const { getDb } = await import("@paycheck/db"); await getDb(); return "ok"; });
await schritt("ATS_BOARDS / loadRegistrations", async () => {
  const { ATS_BOARDS, loadRegistrations } = await import("@paycheck/jobs");
  let n = 0;
  for (const b of ATS_BOARDS) n += (await loadRegistrations(b)).length;
  return `${ATS_BOARDS.length} Boards, ${n} Registrierungen`;
});
await schritt("activeAdapters", async () => {
  const { activeAdapters } = await import("@paycheck/jobs");
  return `${activeAdapters().length} Adapter`;
});
process.exit(0);
