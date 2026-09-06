import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: B, viewport: { width: 1280, height: 900 } });
await s.goto(`${B}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-stand-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 60000 });

for (const [name, pfad] of [["heute","/app"], ["jobs","/app/jobs"], ["faq","/app/faq"]]) {
  await s.goto(`${B}${pfad}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await s.waitForTimeout(2200);
  const d = await s.evaluate(() => ({
    streifen: Boolean(document.querySelector(".nina-streifen__knopf")),
    kopfHoehe: Math.round(document.querySelector("header")?.getBoundingClientRect().height ?? 0),
    klebrig: getComputedStyle(document.querySelector("header")).position,
  }));
  console.log(`${name.padEnd(6)} Kopf ${d.kopfHoehe}px (${d.klebrig}) · Nina-Streifen: ${d.streifen}`);
  await s.screenshot({ path: `/tmp/stand-${name}.png`, clip: { x: 0, y: 0, width: 1280, height: 420 } });
}
await b.close();
