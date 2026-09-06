import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [mit] = (await db.execute(sql`
  select id, title, kldb from jobs where country='DE' and kldb is not null and length(kldb)=5
    and right(kldb,1) in ('1','2','3','4') order by id limit 1`)).rows;
const [ohne] = (await db.execute(sql`
  select id, title from jobs where country='DE' and kldb is null order by id limit 1`)).rows;

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-zuk-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });

for (const [name, j] of [["MIT KldB " + mit.kldb, mit], ["OHNE KldB", ohne]]) {
  await s.goto(`${BASIS}/app/jobs/${j.id}`);
  await s.waitForLoadState("networkidle");
  const block = s.getByRole("heading", { name: /Zukunft dieses Berufsfelds/i });
  if (await block.count()) {
    const karte = block.locator("xpath=ancestor::div[2]");
    console.log(`\n${name}: ${String(j.title).slice(0, 40)}`);
    console.log((await karte.innerText()).replace(/\n+/g, " / ").slice(0, 520));
  } else {
    console.log(`\n${name}: kein Block (richtig, wenn keine Kennung)`);
  }
}
await b.close();
