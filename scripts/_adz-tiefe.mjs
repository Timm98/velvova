import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
const hole = async (land, seite, extra = {}) => {
  const u = new URL(`https://api.adzuna.com/v1/api/jobs/${land}/search/${seite}`);
  u.searchParams.set("app_id", id); u.searchParams.set("app_key", key);
  u.searchParams.set("results_per_page", "50"); u.searchParams.set("content-type", "application/json");
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
  const r = await fetch(u, { signal: AbortSignal.timeout(25000) }).catch(() => null);
  if (!r?.ok) return { status: r?.status ?? 0, n: 0 };
  const d = await r.json().catch(() => null);
  return { status: 200, n: d?.results?.length ?? 0, erste: d?.results?.[0]?.id ?? null };
};
console.log("Ohne Suchbegriff durchblättern (us)");
for (const seite of [1, 10, 50, 100, 200, 500, 1000, 2000]) {
  const r = await hole("us", seite);
  console.log(`  Seite ${String(seite).padStart(5)}  HTTP ${r.status}  ${r.n} Treffer  erste ${r.erste ?? "—"}`);
  await new Promise((x) => setTimeout(x, 400));
}
console.log("\nMit Ortsfilter (us, page 1 je Ort)");
for (const wo of ["New York", "Chicago", "Houston"]) {
  const r = await hole("us", 1, { where: wo, distance: "50" });
  console.log(`  ${wo.padEnd(12)} HTTP ${r.status}  ${r.n} Treffer`);
  await new Promise((x) => setTimeout(x, 400));
}
process.exit(0);
