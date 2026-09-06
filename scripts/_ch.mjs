import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newContext({
  viewport: { width: 1440, height: 620 },
  locale: "de-DE",
  extraHTTPHeaders: { "x-vercel-ip-country": "CH" },
}).then((c) => c.newPage());
await p.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2000);
await p.screenshot({ path: "artifacts/landing/landing-schweiz.png" });
const h = p.getByRole("heading", { name: /was bleibt dir/i }).first();
await h.scrollIntoViewIfNeeded();
await p.waitForTimeout(600);
await p.screenshot({ path: "artifacts/landing/landing-schweiz-lifefit.png" });
await b.close();
