import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 900 } }).then((c) => c.newPage());
await p.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.locator("footer").innerText()));
await b.close();
