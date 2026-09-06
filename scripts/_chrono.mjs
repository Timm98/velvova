import { chromium } from "@playwright/test";
const b = await chromium.launch();
const s = await b.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  await s.goto("https://www.chrono24.de/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await s.waitForTimeout(4000);
  await s.screenshot({ path: "/tmp/chrono-oben.png" });
  // Farben und Schriften auslesen
  const d = await s.evaluate(() => {
    const cs = getComputedStyle(document.body);
    const kopf = document.querySelector("header") ?? document.body;
    const hk = getComputedStyle(kopf);
    const schriften = new Set();
    for (const el of [...document.querySelectorAll("h1,h2,h3,p,a,span,button")].slice(0, 400))
      schriften.add(getComputedStyle(el).fontFamily);
    return {
      bodyBg: cs.backgroundColor, bodyFarbe: cs.color, bodySchrift: cs.fontFamily,
      kopfBg: hk.backgroundColor,
      schriften: [...schriften].slice(0, 6),
    };
  });
  console.log(JSON.stringify(d, null, 2));
} catch (e) { console.log("Fehler:", String(e).slice(0, 200)); }
await b.close();
