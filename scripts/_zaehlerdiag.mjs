import { chromium } from "@playwright/test";
const b = await chromium.launch();
const s = await b.newPage({ viewport: { width: 1280, height: 900 } });
const fehler = [];
s.on("console", m => { if (m.type() === "error") fehler.push(m.text().slice(0,120)); });
s.on("pageerror", e => fehler.push("pageerror: " + String(e).slice(0,120)));
await s.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
await s.waitForTimeout(1000);
for (let i = 0; i < 6; i++) {
  const v = await s.evaluate(() => {
    const h = document.querySelector("h1");
    const m = h?.textContent?.match(/[\d.]{7,}/);
    return m ? m[0] : "-";
  });
  console.log(`${(i*1.5).toFixed(1)}s: ${v}`);
  await s.waitForTimeout(1500);
}
console.log("Konsolenfehler:", fehler.length ? fehler.slice(0,3) : "keine");
await b.close();
