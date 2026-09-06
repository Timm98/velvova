import { chromium } from "@playwright/test";
const b = await chromium.launch();
const s = await b.newPage({ viewport: { width: 1280, height: 900 } });
await s.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
await s.waitForTimeout(2000);
const liste = s.locator("ol").first();
await liste.scrollIntoViewIfNeeded();
const lies = () => s.evaluate(() => {
  const ol = document.querySelector("ol");
  if (!ol) return "keine Liste";
  const punkte = [...ol.querySelectorAll("li > span:first-child > span:first-child")];
  const an = punkte.filter((p) => getComputedStyle(p).backgroundColor.includes("46, 111, 242") || getComputedStyle(p).backgroundColor.includes("2e6ff2")).length;
  return `${an} von ${punkte.length} Punkten aktiv`;
});
for (const y of [0, 200, 500, 900]) {
  await s.evaluate((v) => window.scrollBy(0, v), y);
  await s.waitForTimeout(700);
  console.log(`nach ${y}px:`, await lies());
}
await b.close();
