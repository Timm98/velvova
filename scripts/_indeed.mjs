import { chromium } from "@playwright/test";
const b = await chromium.launch();
const s = await b.newPage({ viewport: { width: 1440, height: 950 } });
try {
  const a = await s.goto("https://de.indeed.com/", { waitUntil: "domcontentloaded", timeout: 45000 });
  console.log("Status:", a?.status());
  await s.waitForTimeout(4000);
  await s.screenshot({ path: "/tmp/indeed-oben.png" });
  const d = await s.evaluate(() => {
    const cs = getComputedStyle(document.body);
    const zaehl = {};
    for (const el of [...document.querySelectorAll("*")].slice(0, 1200)) {
      const f = getComputedStyle(el).fontFamily;
      if (f) zaehl[f] = (zaehl[f] ?? 0) + 1;
    }
    const kopf = document.querySelector("header, [role=banner]");
    return {
      bodyBg: cs.backgroundColor, bodyFarbe: cs.color,
      kopfBg: kopf ? getComputedStyle(kopf).backgroundColor : "-",
      schriften: Object.entries(zaehl).sort((a,b)=>b[1]-a[1]).slice(0,4),
      titel: document.title.slice(0, 60),
    };
  });
  console.log(JSON.stringify(d, null, 2));
} catch (e) { console.log("Fehler:", String(e).slice(0,200)); }
await b.close();
