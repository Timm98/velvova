import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [mitGehalt] = (await db.execute(sql`
  select id, title, salary_min, salary_max, salary_period from jobs
  where country='DE' and salary_min is not null and salary_period='year' order by id limit 1`)).rows;

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-rech-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });

for (const [name, adresse] of [
  ["eigenständig", "/app/tools/gehalt"],
  ["aus der Stelle", `/app/tools/gehalt?jobId=${mitGehalt.id}`],
]) {
  await s.goto(`${BASIS}${adresse}`);
  await s.waitForLoadState("networkidle");
  const t = await s.locator("main").innerText();
  const kopf = t.split("\n").filter((z) => z.trim()).slice(1, 5).join(" / ");
  console.log(`\n${name}:`);
  console.log("  " + kopf.slice(0, 240));
}
console.log(`\nStelle: ${mitGehalt.title.slice(0,40)} · ${mitGehalt.salary_min}–${mitGehalt.salary_max} €`);

/* Links auf der Stellenseite */
await s.goto(`${BASIS}/app/jobs/${mitGehalt.id}`);
await s.waitForLoadState("networkidle");
for (const l of ["Was bleibt mir bei diesem Gehalt übrig?", "Was kostet mich der Weg?"]) {
  console.log(`Link „${l.slice(0,28)}…": ${await s.getByRole("link", { name: l }).count() > 0}`);
}
await b.close();
