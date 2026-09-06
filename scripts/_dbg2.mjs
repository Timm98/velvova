import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [mit] = (await db.execute(sql`
  select id, title, salary_min, salary_max, salary_period, country, location from jobs
  where salary_min is not null and salary_period='year' and country='DE'
    and location is not null and location <> '' and location !~* '^(deutschland|germany)$' limit 1`)).rows;
const [ohne] = (await db.execute(sql`select id, title from jobs where salary_min is null and salary_max is null limit 1`)).rows;
console.log("mit:", JSON.stringify(mit));

const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1200 }, locale: "de-DE" }).then((c) => c.newPage());
p.setDefaultTimeout(60000);
await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`dbg2-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });

await p.goto(`${B}/app/jobs/${mit.id}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(5000);
const netto = await p.locator("text=/Was bleibt dir netto/").locator("xpath=ancestor::section[1]").innerText().catch(() => "NICHT GEFUNDEN");
console.log("--- Netto-Abschnitt ---\n" + netto.slice(0, 400));

await p.goto(`${B}/app/jobs/${ohne.id}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(4000);
const rote = await p.locator('main [class*="critical"]').all();
for (const r of rote) console.log("ROT:", (await r.innerText()).slice(0, 120).replace(/\s+/g," "), "|", await r.getAttribute("class"));

await p.goto(`${B}/app/jobs`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
const f = p.getByRole("searchbox").first();
await f.fill("Nur Stellen ab 45.000 €");
await f.press("Enter");
await p.waitForTimeout(3000);
console.log("URL nach Eingabe:", p.url());
console.log("Vorschläge:", JSON.stringify(await p.locator("main ul li button").allInnerTexts()).slice(0, 300));
await b.close();
process.exit(0);
