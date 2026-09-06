import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [j] = (await db.execute(sql`
  select id, title from jobs where country='DE' and kldb is not null order by id limit 1`)).rows;

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-pass-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });
await s.goto(`${BASIS}/app/jobs/${j.id}`);
await s.waitForLoadState("networkidle");

const t = await s.locator("main").innerText();
for (const k of ["Warum diese Stelle passt", "Was dagegen spricht", "Noch ungeklärt"]) {
  const i = t.toUpperCase().indexOf(k.toUpperCase());
  console.log(`\n${k}: ${i >= 0 ? "da" : "FEHLT"}`);
  if (i >= 0) console.log("  " + t.slice(i + k.length, i + k.length + 230).replace(/\n+/g, " / ").trim());
}
const v = t.match(/Vorläufige Einschätzung[^\n]*/);
console.log("\n" + (v ? v[0] : "kein Vorläufigkeitshinweis"));
await b.close();
