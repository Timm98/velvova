import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [ohne] = (await db.execute(sql`
  select j.id, j.title, j.kldb, e.beruf, e.median from jobs j
  join entgelt_kldb e on e.kldb = j.kldb
  where j.country='DE' and j.salary_min is null and j.salary_max is null
  order by j.id limit 1`)).rows;
console.log("Stelle ohne eigenes Gehalt:", String(ohne.title).slice(0, 50));
console.log("  KldB", ohne.kldb, "→", ohne.beruf, "· Median", Number(ohne.median).toLocaleString("de-DE"), "€");

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-geh-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });
await s.goto(`${BASIS}/app/jobs/${ohne.id}`);
await s.waitForLoadState("networkidle");
const text = await s.locator("main").innerText();
const zeile = text.split("\n").find((z) => /€/.test(z) && /\d/.test(z));
console.log("\nauf der Seite:", zeile ?? "keine Gehaltszeile");
const hinweis = text.match(/[^\n]*(gesch[äa]tzt|Referenz|Entgeltatlas|Vergleichswert)[^\n]*/i);
console.log("Herkunftshinweis:", hinweis ? hinweis[0].slice(0, 140) : "—");

await s.goto(`${BASIS}/app/jobs`);
await s.waitForLoadState("networkidle");
const liste = await s.locator("main").innerText();
const mitCa = (liste.match(/ca\. [\d.]+ – [\d.]+ €/g) ?? []).length;
const ohneAngabe = (liste.match(/Gehalt nicht angegeben/g) ?? []).length;
console.log(`\nListe: ${mitCa} Referenzspannen · ${ohneAngabe} ohne Angabe`);
console.log("\nAusschnitt der Liste:");
console.log(liste.split("\n").filter((z) => z.trim()).slice(14, 34).join(" / ").slice(0, 700));
await b.close();
