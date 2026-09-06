import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1000, height: 1000 }, locale: "de-DE" }).then((c) => c.newPage());
p.setDefaultTimeout(90000);
await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`shot-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });
await p.goto(`${B}/app/jobs/${process.argv[2]}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
const h = p.getByRole("heading", { name: "Was die Anzeige bietet" }).first();
await h.scrollIntoViewIfNeeded();
await p.waitForTimeout(500);
const box = await h.boundingBox();
await p.screenshot({
  path: "/Users/timenseling/paycheck-rebuild/artifacts/life-fit/leistungen-karte.png",
  clip: { x: Math.max(0, box.x - 30), y: Math.max(0, box.y - 30), width: 940, height: 700 },
});
await b.close();
