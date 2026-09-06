import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 1400 } });
await p.goto(process.argv[2]);
await p.waitForTimeout(800);
await p.screenshot({ path: process.argv[3], fullPage: true });
await b.close();
