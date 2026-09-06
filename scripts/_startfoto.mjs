import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: B, viewport: { width: 1280, height: 900 } });
await s.goto(`${B}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-start-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 60000 });
await s.goto(`${B}/app`, { waitUntil: "domcontentloaded", timeout: 180000 });
await s.waitForTimeout(7000);
const d = await s.evaluate(() => ({
  canvas: document.querySelectorAll("canvas").length,
  streifen: Boolean(document.querySelector(".nina-streifen__knopf")),
}));
console.log(`Core-Canvas: ${d.canvas} · alter Streifen noch da: ${d.streifen}`);
await s.screenshot({ path: "/tmp/start-hell.png", clip: { x: 0, y: 0, width: 1280, height: 620 } });
await b.close();
