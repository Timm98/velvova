import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [mit] = (await db.execute(sql`
  select id from jobs where salary_min is not null and salary_period='year' and country='DE'
    and location is not null and location <> '' and location !~* '^(deutschland|germany)$' limit 1`)).rows;

const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1100 }, locale: "de-DE" }).then((c) => c.newPage());
p.setDefaultTimeout(90000);
p.setDefaultNavigationTimeout(90000);

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`bild-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });

await p.goto(`${B}/app/settings/language-region`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);
await p.getByLabel("Wohnort").fill("Karlsruhe");
await p.getByRole("button", { name: /Speichern|Übernehmen/i }).first().click();
await p.waitForTimeout(2500);

const schuss = async (datei) => {
  await p.screenshot({ path: `artifacts/kern/${datei}` });
  console.log(`  ${datei}`);
};

await p.goto(`${B}/app/jobs`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(4000);
await schuss("jobs-core-final.png");
await schuss("jobs-unknown-neutral.png");

await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(1200);
await schuss("load-more.png");

const feld = p.getByRole("searchbox").first();
await p.evaluate(() => window.scrollTo(0, 0));
await feld.fill("Nur Stellen ab 45.000 €");
await feld.press("Enter");
await p.locator('ul[aria-label="Aktive Filter"] button').first().waitFor({ state: "visible", timeout: 30000 });
await p.waitForTimeout(400);
await schuss("quick-input-confirmation.png");
await p.waitForTimeout(2500);
await schuss("jobs-salary.png");

await p.goto(`${B}/app/jobs/${mit.id}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(9000);
const netto = p.getByRole("heading", { name: /Was bleibt dir netto/ }).first();
await netto.scrollIntoViewIfNeeded();
await p.waitForTimeout(600);
await p.getByRole("button", { name: /Details berechnen/ }).click();
await p.waitForTimeout(900);
await p.locator('input[aria-label="Wohnen je Monat in Euro"]').fill("1200");
await p.locator('input[aria-label="Mobilität je Monat in Euro"]').fill("180");
await p.waitForTimeout(900);
await netto.scrollIntoViewIfNeeded();
await p.waitForTimeout(400);
await schuss("salary-calculator.png");

const weg = p.getByRole("heading", { name: /Dein Arbeitsweg/ }).first();
await weg.scrollIntoViewIfNeeded();
await p.waitForTimeout(600);
await schuss("commute-calculator.png");

const life = p.getByRole("heading", { name: /Alltag/ }).first();
await life.scrollIntoViewIfNeeded();
await p.waitForTimeout(600);
await schuss("life-fit.png");

await b.close();
process.exit(0);
