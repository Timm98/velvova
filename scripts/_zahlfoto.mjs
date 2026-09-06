import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: B, viewport: { width: 1280, height: 900 } });
await s.goto(`${B}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-foto-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });
await s.goto(`${B}/app/jobs`, { waitUntil: "networkidle" }).catch(()=>{});
await s.waitForTimeout(2000);
const leiste = s.locator(".zahlungsarten");
await leiste.scrollIntoViewIfNeeded();
await s.waitForTimeout(2500);

for (const thema of ["light", "dark"]) {
  await s.evaluate((t) => document.documentElement.setAttribute("data-theme", t), thema);
  await s.waitForTimeout(1200);
  await s.locator("section[aria-labelledby='zahlungsarten']").screenshot({ path: `/tmp/zahlprobe/fuss-${thema}.png` });
  const w = await s.evaluate(() => [...document.querySelectorAll(".zahlungsbadge")].map((el) => {
    const bild = [...el.querySelectorAll("img")].find((i) => getComputedStyle(i).display !== "none");
    const r = el.getBoundingClientRect();
    return `${Math.round(r.height)}x${Math.round(r.width)} ${bild?.getAttribute("src").split("/").pop()} nat=${bild?.naturalWidth}x${bild?.naturalHeight}`;
  }));
  console.log(`${thema}: ${w.join(" | ")}`);
}
await b.close();
