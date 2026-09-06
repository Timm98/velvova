import { chromium } from "@playwright/test";
const b = await chromium.launch();
const s = await b.newPage({ viewport: { width: 320, height: 900 } });
await s.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
await s.waitForTimeout(2500);
const d = await s.evaluate(() => {
  const doc = document.documentElement;
  const treffer = [...document.querySelectorAll("body *")]
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .slice(0, 5)
    .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0,3).join(".")} scroll ${el.scrollWidth} client ${el.clientWidth}`.slice(0,110));
  return { docScroll: doc.scrollWidth, docClient: doc.clientWidth, treffer };
});
console.log(`Dokument: scroll ${d.docScroll}, sichtbar ${d.docClient}`);
console.log(d.treffer.join("\n") || "kein Element rollt waagerecht");
await b.close();
