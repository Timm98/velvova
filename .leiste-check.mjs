import { chromium, webkit } from "@playwright/test";
const OUT = "/tmp/claude-501/-Users-timenseling-eupoc-website/28d697a3-5cfe-4e9f-a750-7542f36102f2/scratchpad";

for (const [name, bt] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await bt.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3021/api/dev/login", { waitUntil: "domcontentloaded" });

  for (const pfad of ["/app/monday", "/app/jobs"]) {
    await page.goto("http://localhost:3021" + pfad, { waitUntil: "networkidle" });
    const aside = await page.locator('aside[aria-label="Arbeitsbereiche"]').boundingBox();
    const konto = await page.locator('aside[aria-label="Arbeitsbereiche"] button[aria-haspopup="menu"]').boundingBox();
    const dokRollt = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 2);
    const quer = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    console.log(`${name} ${pfad}: aside=${Math.round(aside.height)}px kontoUnterkante=${Math.round(konto.y + konto.height)} dokumentRollt=${dokRollt} querlauf=${quer}`);
  }

  // Kontomenue oeffnen und nachsehen, ob es ins Bild passt.
  await page.locator('aside button[aria-haspopup="menu"]').click();
  const menu = await page.locator('aside div[role="menu"]').boundingBox();
  console.log(`${name} Menue: oben=${Math.round(menu.y)} unten=${Math.round(menu.y + menu.height)} (Fenster 900)`);
  await page.screenshot({ path: `${OUT}/konto-${name}.png`, clip: { x: 0, y: 300, width: 420, height: 600 } });
  await browser.close();
}
