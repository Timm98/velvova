import { chromium } from "@playwright/test";
const b = await chromium.launch();
const s = await b.newPage({ viewport: { width: 1440, height: 300 } });
await s.goto("http://localhost:3000/register", { waitUntil: "domcontentloaded" });
await s.waitForTimeout(2500);
const d = await s.evaluate(() => {
  const p = [...document.querySelectorAll("p")].find(e => e.textContent.includes("App kommt bald"));
  if (!p) return null;
  const r = p.getBoundingClientRect();
  const t = p.querySelector("span") ?? p;
  // Mitte des sichtbaren Textes gegen Fenstermitte
  const bereich = document.createRange(); bereich.selectNodeContents(p);
  const tr = bereich.getBoundingClientRect();
  return { textMitte: Math.round(tr.left + tr.width/2), fensterMitte: Math.round(innerWidth/2) };
});
console.log(d ? `Textmitte ${d.textMitte}px, Fenstermitte ${d.fensterMitte}px, Abweichung ${Math.abs(d.textMitte-d.fensterMitte)}px` : "Leiste nicht gefunden");
await b.close();
