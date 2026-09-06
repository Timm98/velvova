import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS, viewport: { width: 1440, height: 900 } });
const mail = `e2e-alarm-${Date.now()}@example.invalid`;
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(mail);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });
const [u] = (await db.execute(sql`select id from users where email = ${mail}`)).rows;

await s.goto(`${BASIS}/app/jobs?ort=Karlsruhe&contract=permanent`, { timeout: 120000 });
await s.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});

const feld = s.getByLabel("Name für diese Suche");
console.log("Alarmfeld:", await feld.count() > 0, "· Vorschlag:", JSON.stringify(await feld.inputValue().catch(() => "")));
await s.getByRole("button", { name: "Suche merken" }).click();
await s.waitForTimeout(2500);
const t = await s.locator("main").innerText();
console.log("Antwort:", (t.match(/Die Suche ist gemerkt[^\n]*/) ?? ["—"])[0].slice(0, 130));

const r = (await db.execute(sql`select name, filter from job_alarme where user_id = ${u.id}::uuid`)).rows;
console.log("in der Datenbank:", r.length, r[0] ? `„${r[0].name}" · ${r[0].filter}` : "");

/* Region und Theme im Footer */
const region = s.getByLabel(/Region & Sprache/i);
console.log("\nRegionsauswahl:", await region.count() > 0, "· Wert:", await region.inputValue().catch(() => "—"));
const seite = await s.locator("body").innerText();
console.log("Theme-Wähler im Footer:", seite.includes("Darstellung"));
console.log("Märkte im Footer:", /Österreich · EUR/.test(seite));
console.log("ohne Gehaltsreferenz vermerkt:", /ohne amtliche Gehaltsreferenz/.test(seite));
await b.close();
