import { chromium } from "@playwright/test";
const b = await chromium.launch();
const s = await b.newPage({ viewport: { width: 1280, height: 1000 } });
await s.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
await s.waitForTimeout(2500);
console.log("Seitenhöhe:", await s.evaluate(() => document.body.scrollHeight), "px");
for (const y of [0, 3000, 6000, 9000]) {
  await s.evaluate((v) => window.scrollTo(0, v), y);
  await s.waitForTimeout(1600);
  await s.screenshot({ path: `/tmp/end-${y}.png`, clip: { x: 0, y: 0, width: 1280, height: 980 } });
}
console.log("Bilder erzeugt");
await b.close();
