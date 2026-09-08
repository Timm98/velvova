import { chromium } from "@playwright/test";

const browser = await chromium.launch();
for (const modus of ["light", "dark"]) {
  const kontext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: modus,
    deviceScaleFactor: 2,
  });
  const seite = await kontext.newPage();
  await seite.goto("http://localhost:3007/", { waitUntil: "domcontentloaded" });
  await seite.evaluate((m) => {
    document.documentElement.dataset.theme = m;
  }, modus);
  await seite.waitForTimeout(1500);
  await seite.evaluate(() => window.scrollTo(0, 700));
  await seite.waitForTimeout(700);
  await seite.screenshot({ path: `/tmp/partnerleiste-${modus}.png` });
  console.log(`  ${modus} gespeichert`);
  await kontext.close();
}
await browser.close();
