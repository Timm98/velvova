import { chromium } from "@playwright/test";
const b = await chromium.launch();
const s = await b.newPage({ viewport: { width: 1280, height: 900 } });
await s.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
await s.waitForTimeout(3500);
for (let i = 0; i < 3; i++) {
  const d = await s.evaluate(() => {
    const h = document.querySelector("h1")?.textContent?.match(/[\d.]{7,}/)?.[0] ?? "-";
    const p = document.querySelector("#kopf-stellensuche")?.getAttribute("placeholder")?.match(/[\d.]{7,}/)?.[0] ?? "-";
    return { h, p };
  });
  console.log(`Überschrift ${d.h}  ·  Kopfsuche ${d.p}  ·  gleich: ${d.h === d.p}`);
  await s.waitForTimeout(2000);
}
await b.close();
