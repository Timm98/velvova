import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [ohne] = (await db.execute(sql`select id from jobs where salary_min is null and salary_max is null limit 1`)).rows;
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1200 }, locale: "de-DE" }).then((c) => c.newPage());
p.setDefaultTimeout(60000);
await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`dbg3-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });
await p.goto(`${B}/app/jobs/${ohne.id}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(4000);
for (const r of await p.locator('main [class*="critical"]').all()) {
  const txt = (await r.innerText()).slice(0, 60).replace(/\s+/g, " ");
  const cls = await r.getAttribute("class");
  const eltern = await r.evaluate((el) => {
    const p = el.closest("section,article,div[class*=card],li");
    return (p?.textContent ?? "").slice(0, 160).replace(/\s+/g, " ");
  });
  console.log(`ROT «${txt}» [${cls}]\n  Kontext: ${eltern}\n`);
}
await b.close();
process.exit(0);
