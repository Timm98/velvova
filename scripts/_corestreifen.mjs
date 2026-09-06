import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: B, viewport: { width: 1440, height: 900 } });
await s.goto(`${B}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-core-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 60000 });
await s.goto(`${B}/app/jobs`, { waitUntil: "domcontentloaded", timeout: 120000 });
await s.waitForTimeout(2500);
const vorher = await s.evaluate(() => document.querySelectorAll("canvas").length);
// Interesse zeigen: Maus bewegen und scrollen
await s.mouse.move(600, 400); await s.mouse.wheel(0, 200); await s.waitForTimeout(6000);
const nachher = await s.evaluate(() => ({
  canvas: document.querySelectorAll("canvas").length,
  imStreifen: !!document.querySelector("header + div canvas, .nina-streifen canvas"),
}));
console.log(`Canvas vor Interaktion: ${vorher}, danach: ${nachher.canvas}`);
await s.locator("header").screenshot({ path: "/tmp/kopf-dark.png" }).catch(()=>{});
await s.evaluate(() => document.documentElement.setAttribute("data-theme","light"));
await s.waitForTimeout(800);
const streifen = s.locator("header").locator("xpath=following-sibling::div[1]");
await streifen.screenshot({ path: "/tmp/streifen-light.png" }).catch(()=>{});
await b.close();
