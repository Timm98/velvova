import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1240, height: 900 } }).then((c) => c.newPage());
await p.goto("file://" + process.argv[2], { waitUntil: "networkidle" });
await p.screenshot({ path: process.argv[3], fullPage: true });
await b.close();
