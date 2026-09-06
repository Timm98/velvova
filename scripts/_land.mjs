import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" }).then((c) => c.newPage());
await p.goto(`${B}${process.argv[2] ?? "/"}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);
await p.screenshot({ path: process.argv[3] ?? "/tmp/land.png", fullPage: process.argv[4] === "full" });
await b.close();
