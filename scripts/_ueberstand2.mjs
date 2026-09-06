import { chromium } from "@playwright/test";
const b = await chromium.launch();
for (const w of [320, 768]) {
  const s = await b.newPage({ viewport: { width: w, height: 900 } });
  await s.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await s.waitForTimeout(2500);
  const t = await s.evaluate(() => {
    const breit = document.documentElement.clientWidth;
    return [...document.querySelectorAll("body *")]
      .map((el) => ({ r: Math.round(el.getBoundingClientRect().right), w: Math.round(el.getBoundingClientRect().width), el }))
      .filter((x) => x.r > breit + 1)
      .slice(0, 5)
      .map((x) => `${x.r}px (breit ${x.w})  ${x.el.tagName.toLowerCase()}.${String(x.el.className).split(" ").slice(0,4).join(".")}`.slice(0, 120));
  });
  console.log(`── ${w}px ──\n` + (t.join("\n") || "nichts steht über"));
  await s.close();
}
await b.close();
