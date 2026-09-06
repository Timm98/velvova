import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
const info = await p.evaluate(() => {
  const el = document.elementFromPoint(843, 250);
  const kette = [];
  let c = el;
  for (let i = 0; c && i < 5; i++, c = c.parentElement) {
    const r = c.getBoundingClientRect();
    kette.push(`${c.tagName.toLowerCase()}${c.className && typeof c.className === "string" ? "." + c.className.trim().split(/\s+/).slice(0, 5).join(".") : ""} [${Math.round(r.width)}×${Math.round(r.height)}]`);
  }
  const canvas = document.querySelector("canvas");
  return { kette, canvas: canvas ? `canvas ${canvas.width}×${canvas.height}` : "kein canvas" };
});
console.log("Element an (843,250):");
info.kette.forEach((k, i) => console.log(`  ${" ".repeat(i * 2)}${k}`));
console.log("3D:", info.canvas);
await b.close();
