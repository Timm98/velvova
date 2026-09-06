import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/* Eine Stelle, die deutlich über dem p90 ihrer Gruppe liegt. */
const [alt] = (await db.execute(sql`
  select j.id, j.title, j.published_at, r.gruppe, r.median_tage, r.p90_tage
  from jobs j join standzeit_referenz r on r.gruppe = substring(j.kldb from 1 for 2)
  where j.country = 'DE' and j.published_at is not null and r.stellen >= 3000
    and extract(epoch from (now() - j.published_at)) / 86400 > r.p90_tage
  order by j.id limit 1`)).rows;
/* Und eine frische derselben Gruppe — dort darf nichts stehen. */
const [neu] = (await db.execute(sql`
  select j.id, j.title from jobs j
  where j.country = 'DE' and substring(j.kldb from 1 for 2) = ${alt.gruppe}
    and j.published_at > now() - interval '10 days'
  order by j.id limit 1`)).rows;

console.log("auffällig:", alt.title.slice(0, 50), "| Gruppe", alt.gruppe,
  "| Median", Math.round(alt.median_tage), "p90", Math.round(alt.p90_tage));

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-stand-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });

for (const [name, j] of [["ALT", alt], ["FRISCH", neu]]) {
  if (!j) { console.log(name, "— keine Stelle gefunden"); continue; }
  await s.goto(`${BASIS}/app/jobs/${j.id}`);
  await s.waitForLoadState("networkidle");
  const block = s.getByRole("heading", { name: /Wie lange diese Anzeige steht/i });
  if (await block.count()) {
    const karte = block.locator("xpath=ancestor::div[1]");
    console.log(`\n${name}: ${(await karte.innerText()).replace(/\n+/g, " / ")}`);
  } else {
    console.log(`\n${name}: kein Block (richtig, wenn unauffällig)`);
  }
}
await b.close();
