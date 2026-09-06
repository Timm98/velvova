import { chromium } from "@playwright/test";
const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-dom-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });
await s.goto(`${BASIS}/app/proben`);
await s.waitForLoadState("networkidle");
const knoepfe = await s.locator("main button").evaluateAll((es) =>
  es.map((e) => `${e.getAttribute("aria-pressed")} | ${e.className.slice(0, 40)} | ${e.innerText.slice(0, 45)}`));
console.log(knoepfe.join("\n"));
await b.close();
