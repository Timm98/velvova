import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: B, viewport: { width: 1280, height: 900 } });
await s.goto(`${B}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-bp-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 60000 });
await s.goto(`${B}/app`, { waitUntil: "domcontentloaded", timeout: 180000 });
await s.waitForTimeout(3000);
for (const thema of ["light","dark"]) {
  await s.evaluate((t) => document.documentElement.setAttribute("data-theme", t), thema);
  await s.waitForTimeout(600);
  const d = await s.evaluate(() => {
    const el = document.querySelector(".zahlungsbadge");
    if (!el) return "keine Badges gefunden";
    const bild = [...el.querySelectorAll("img")].find(i => getComputedStyle(i).display !== "none");
    return `${getComputedStyle(el).backgroundColor} · sichtbares Bild ${bild?.getAttribute("src").split("/").pop()}`;
  });
  console.log(`${thema}: ${d}`);
  // Abstaende der Fussbloecke
  const abst = await s.evaluate(() => {
    const b = [...document.querySelectorAll("footer h2")].map(h => Math.round(h.getBoundingClientRect().top));
    return b.slice(0, 8).join(",");
  });
  if (thema === "light") console.log("  Überschriften-Positionen:", abst);
}
await b.close();
