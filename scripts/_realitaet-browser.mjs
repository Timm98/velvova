import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const [stelle] = (await db.execute(sql`
  select id, title from jobs where country='DE' and description is not null order by id limit 1`)).rows;

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
const mail = `e2e-real-${Date.now()}@example.invalid`;
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(mail);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });

await s.goto(`${BASIS}/app/jobs/${stelle.id}`);
await s.waitForLoadState("networkidle");
const anbieten = s.getByRole("button", { name: /Biete fünfzehn Minuten an/i });
console.log("Angebot-Knopf sichtbar:", await anbieten.count() > 0);
await anbieten.click();
await s.getByLabel(/Was du erzählen kannst/i).fill("Wie ein normaler Dienstag in dieser Rolle aussieht, ehrlich.");
await s.getByRole("button", { name: "Anbieten" }).click();
await s.waitForTimeout(2500);

const [n] = (await db.execute(sql`select count(*)::int n from realitaetsproben where job_id = ${stelle.id}::uuid`)).rows;
console.log("realitaetsproben nach dem Anbieten:", n.n);

await s.reload();
await s.waitForLoadState("networkidle");
const rueck = s.getByRole("button", { name: /Sag, wie es war/i });
console.log("Rückmeldung-Knopf sichtbar:", await rueck.count() > 0);
if (await rueck.count()) {
  await rueck.click();
  await s.locator("fieldset").first().getByRole("button", { name: "4" }).click();
  await s.locator("fieldset").nth(1).getByRole("button", { name: "5" }).click();
  await s.getByRole("button", { name: "Abschicken" }).click();
  await s.waitForTimeout(2500);
  const [m] = (await db.execute(sql`select count(*)::int n, max(klarheit) k from realitaetsrueckmeldungen`)).rows;
  console.log("realitaetsrueckmeldungen:", m.n, "| Klarheit:", m.k);
  console.log("Antwort:", (await s.locator("main").innerText()).match(/Danke\.[^\n]*/)?.[0] ?? "—");
}
await b.close();
