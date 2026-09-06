import { chromium } from "@playwright/test";
const b = await chromium.launch();
const s = await b.newPage({ viewport: { width: 320, height: 800 } });
await s.goto("http://localhost:3000/help", { waitUntil: "domcontentloaded", timeout: 120000 });
await s.waitForTimeout(2000);
const t = await s.evaluate(() => {
  const breit = document.documentElement.clientWidth;
  return [...document.querySelectorAll("body *")]
    .map((el) => ({ r: Math.round(el.getBoundingClientRect().right), el }))
    .filter((x) => x.r > breit + 1)
    .slice(0, 6)
    .map((x) => `${x.r}px  ${x.el.tagName.toLowerCase()}.${String(x.el.className).split(" ").slice(0,3).join(".")}`.slice(0, 110));
});
console.log(t.join("\n") || "nichts steht über");
await b.close();
