import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-land-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });

await s.goto(`${BASIS}/app/jobs`);
await s.waitForLoadState("networkidle");
const zeilen = s.locator('a[href^="/app/jobs/"]').filter({ hasText: /./ });
const n = await zeilen.count();
console.log("Zeilen in der Liste:", n);
const orte = await s.locator("main").innerText();
const auffaellig = ["Christchurch", "Canterbury", "New Zealand", "Neuseeland", "Auckland", "Mumbai", "Guadalajara"]
  .filter((w) => orte.includes(w));
console.log("Ausland in der Liste:", auffaellig.length ? auffaellig.join(", ") : "keins");
console.log("\nErste Zeilen:");
console.log(orte.split("\n").filter((z) => z.trim()).slice(6, 20).join(" / ").slice(0, 400));
await b.close();
