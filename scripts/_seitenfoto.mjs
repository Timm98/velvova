import { chromium } from "@playwright/test";
const b = await chromium.launch();
const s = await b.newPage({ viewport: { width: 1280, height: 1000 } });
await s.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
await s.waitForTimeout(2500);
const h = await s.evaluate(() => document.body.scrollHeight);
console.log("Seitenhöhe:", h, "px");
for (const y of [2600, 4200]) {
  await s.evaluate((v) => window.scrollTo(0, v), y);
  await s.waitForTimeout(1400);
  await s.screenshot({ path: `/tmp/seite-${y}.png`, clip: { x: 0, y: 0, width: 1280, height: 950 } });
}
await b.close();
