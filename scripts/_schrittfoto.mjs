import { chromium } from "@playwright/test";
const b = await chromium.launch();
const s = await b.newPage({ viewport: { width: 1280, height: 950 } });
await s.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
await s.waitForTimeout(2500);
const treffer = await s.evaluate(() => {
  const el = [...document.querySelectorAll("li")].find((l) => l.textContent.includes("Stelle gewählt"));
  if (!el) return null;
  const ol = el.closest("ol");
  ol.scrollIntoView({ block: "center" });
  return true;
});
console.log("Schrittliste gefunden:", Boolean(treffer));
await s.waitForTimeout(1500);
await s.screenshot({ path: "/tmp/schritte.png", clip: { x: 0, y: 0, width: 1280, height: 930 } });
await b.close();
