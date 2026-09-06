import { chromium } from "@playwright/test";
const b = await chromium.launch();
const s = await b.newPage({ viewport: { width: 1280, height: 1000 } });
await s.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
await s.waitForTimeout(2500);
const f = s.locator("figure").first();
const da = await f.count();
console.log("Diagramm vorhanden:", da > 0);
if (da > 0) { await f.scrollIntoViewIfNeeded(); await s.waitForTimeout(1200); await f.screenshot({ path: "/tmp/befund.png" }); }
await b.close();
