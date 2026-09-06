import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [j] = (await db.execute(sql`
  select id, title, location from jobs where country='DE' and location is not null
    and location !~* '^(deutschland|germany)$' order by id limit 1`)).rows;

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-route-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });

await s.goto(`${BASIS}/app/tools/route`);
await s.waitForLoadState("networkidle");
console.log("eigenständig · Ziel vorbelegt:", JSON.stringify(await s.getByLabel("Zieladresse").inputValue()));

await s.goto(`${BASIS}/app/tools/route?jobId=${j.id}`);
await s.waitForLoadState("networkidle");
console.log("aus der Stelle · Ziel:", JSON.stringify(await s.getByLabel("Zieladresse").inputValue()));
const hinweis = (await s.locator("main").innerText()).match(/Aus der Stelle[^\n]*/);
console.log("  Hinweis:", hinweis ? hinweis[0].slice(0, 90) : "—");

await s.getByLabel("Startadresse").fill("Karlsruhe");
await s.getByLabel("Kosten je Kilometer").fill("0,30");
await s.getByRole("button", { name: "Berechnen" }).click();
await s.waitForTimeout(9000);
const t = await s.locator("main").innerText();
const zeilen = t.split("\n").filter((z) => /km|min|Stunden|€|offen/.test(z)).slice(0, 10);
console.log("\nErgebnis:");
console.log("  " + zeilen.join(" / ").slice(0, 420));

await s.getByRole("button", { name: "Zurücksetzen" }).click();
await s.waitForTimeout(600);
console.log("\nnach Zurücksetzen · Ziel:", JSON.stringify(await s.getByLabel("Zieladresse").inputValue()));
await b.close();
