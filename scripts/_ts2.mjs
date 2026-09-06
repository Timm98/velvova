import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { envWert } = await import("../packages/jobs/src/net.ts");
const key = envWert("THEIRSTACK_API_KEY");
const r = await fetch("https://api.theirstack.com/v1/jobs/search", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ page: 0, limit: 1, posted_at_max_age_days: 7, job_country_code_or: ["DE"] }),
  signal: AbortSignal.timeout(30000),
});
console.log("Status:", r.status);
for (const [k, v] of r.headers.entries()) {
  if (/credit|limit|quota|remain|rate/i.test(k)) console.log(`  ${k}: ${v}`);
}
const d = await r.json().catch(() => ({}));
const meta = d?.metadata ?? {};
for (const [k, v] of Object.entries(meta)) console.log(`  metadata.${k}: ${JSON.stringify(v).slice(0, 80)}`);
process.exit(0);
