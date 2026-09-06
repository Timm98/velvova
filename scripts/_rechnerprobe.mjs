import { chromium } from "@playwright/test";
const b = await chromium.launch();
const s = await b.newPage({ viewport: { width: 1280, height: 900 } });
await s.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
await s.waitForTimeout(2000);
await s.evaluate(() => {
  const el = [...document.querySelectorAll("span")].find((x) => x.textContent.trim() === "Frei verfügbar");
  if (el) el.closest("div").scrollIntoView({ block: "center" });
});
const lies = () => s.evaluate(() => {
  const el = [...document.querySelectorAll("span")].find((x) => x.textContent.trim() === "Frei verfügbar");
  if (!el) return "nicht gefunden";
  const kasten = el.closest("div").parentElement;
  return [...kasten.querySelectorAll("span.font-mono")].map((x) => x.textContent.trim()).join(" | ");
});
for (const ms of [80, 500, 1000, 2200]) { await s.waitForTimeout(ms); console.log(`+${ms}ms: ${await lies()}`); }
await b.close();
