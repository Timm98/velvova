import { chromium } from "@playwright/test";
const b = await chromium.launch();
const s = await b.newPage({ viewport: { width: 1280, height: 800 } });
await s.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded", timeout: 120000 });
await s.waitForTimeout(2000);
const d = await s.evaluate(() => {
  const h = getComputedStyle(document.documentElement);
  const b = getComputedStyle(document.body);
  return {
    htmlBg: h.backgroundColor, bodyBg: b.backgroundColor,
    bodyHoehe: document.body.getBoundingClientRect().height,
    htmlHoehe: document.documentElement.getBoundingClientRect().height,
    /* Wer malt die Leinwand? Das erste Element mit gesetzter Fläche. */
    leinwand: h.backgroundColor !== "rgba(0, 0, 0, 0)" ? "html" : "body",
  };
});
console.log(JSON.stringify(d, null, 2));
await b.close();
