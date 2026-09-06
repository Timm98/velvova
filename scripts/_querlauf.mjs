import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const BREITEN = [320, 375, 390, 430, 768, 1024, 1280, 1440];
const SEITEN = ["/", "/jobs", "/jobs?q=Pflegefachkraft&ort=Berlin", "/help", "/login"];
const b = await chromium.launch();
let schlecht = 0;
for (const pfad of SEITEN) {
  const zeile = [];
  for (const w of BREITEN) {
    const s = await b.newPage({ viewport: { width: w, height: 900 } });
    await s.goto(`${B}${pfad}`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await s.waitForTimeout(700);
    const ueber = await s.evaluate(() =>
      Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
    if (ueber > 0) { zeile.push(`${w}:+${ueber}px`); schlecht++; }
    await s.close();
  }
  console.log(`${pfad.padEnd(36)} ${zeile.length ? "QUERLAUF " + zeile.join(" ") : "sauber"}`);
}
console.log(`\nStellen mit Querlauf: ${schlecht}`);
await b.close();
