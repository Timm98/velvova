import { chromium } from "@playwright/test";
const b = await chromium.launch();
const s = await b.newPage({ viewport: { width: 1280, height: 900 } });
await s.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
await s.waitForTimeout(2000);
const lies = () => s.evaluate(() => {
  const h = document.querySelector("h1");
  const m = h?.textContent?.match(/[\d.]{7,}/);
  return m ? m[0] : "nicht gefunden";
});
for (let i = 0; i < 4; i++) {
  console.log(`${i*3}s: ${await lies()}`);
  await s.waitForTimeout(3000);
}
await b.close();
