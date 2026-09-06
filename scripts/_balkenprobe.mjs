import { chromium } from "@playwright/test";
const b = await chromium.launch();
const s = await b.newPage({ viewport: { width: 1280, height: 900 } });
await s.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
await s.waitForTimeout(2000);
const lies = () =>
  s.evaluate(() => {
    const f = document.querySelector("figure");
    if (!f) return "kein Diagramm";
    const spans = f.querySelectorAll("li span");
    const zahl = spans[1] ? spans[1].textContent.trim() : "-";
    const riegel = f.querySelector('div[role="img"] > div');
    const breite = riegel ? riegel.style.width : "-";
    return `${zahl} · Balken ${breite}`;
  });
console.log("vor dem Scrollen:", await lies());
await s.locator("figure").first().scrollIntoViewIfNeeded();
for (const ms of [150, 450, 1500]) {
  await s.waitForTimeout(ms);
  console.log(`nach ${ms} ms:`, await lies());
}
await b.close();
