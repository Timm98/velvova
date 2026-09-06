import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/* Eine feste Stelle, damit ein Fehlschlag wiederholbar ist. */
const [stelle] = (await db.execute(sql`
  select id, title from jobs where country = 'DE' and description is not null
  order by id limit 1`)).rows;
console.log("Stelle:", stelle.title.slice(0, 60));

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
const mail = `e2e-match-${Date.now()}@example.invalid`;
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(mail);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });

const [nutzer] = (await db.execute(sql`select id from users where email = ${mail}`)).rows;
const vorher = (await db.execute(sql`select count(*)::int n from job_matches where user_id = ${nutzer.id}::uuid`)).rows[0].n;

await s.goto(`${BASIS}/app/jobs/${stelle.id}`);
await s.waitForLoadState("networkidle");
await s.waitForTimeout(2500);

const nachher = (await db.execute(sql`
  select fit_score, fit_band, overall_score, scoring_version from job_matches
  where user_id = ${nutzer.id}::uuid`)).rows;
console.log(`job_matches vorher ${vorher} → nachher ${nachher.length}`);
if (nachher[0]) console.log("  ", JSON.stringify(nachher[0]));
await b.close();
