import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const s0 = await b.newPage({ baseURL: B });
await s0.goto(`${B}/register`);
await s0.getByLabel("E-Mail-Adresse").fill(`e2e-mob-${Date.now()}@example.invalid`);
await s0.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s0.getByRole("button", { name: /Konto anlegen/i }).click();
await s0.waitForURL(/\/(app|setup)/, { timeout: 45000 });
const zustand = await s0.context().storageState();
await s0.close();

for (const w of [320, 375, 430, 768, 1280]) {
  const ctx = await b.newContext({ storageState: zustand, viewport: { width: w, height: 900 } });
  const s = await ctx.newPage();
  await s.goto(`${B}/app/jobs`, { waitUntil: "domcontentloaded" });
  await s.waitForTimeout(1500);
  await s.locator(".zahlungsarten").scrollIntoViewIfNeeded().catch(()=>{});
  await s.waitForTimeout(1200);
  const d = await s.evaluate(() => {
    const leiste = document.querySelector(".zahlungsarten");
    const badges = [...document.querySelectorAll(".zahlungsbadge")];
    const r = leiste.getBoundingClientRect();
    return {
      hoehen: [...new Set(badges.map(b => Math.round(b.getBoundingClientRect().height)))],
      zeilen: new Set(badges.map(b => Math.round(b.getBoundingClientRect().top))).size,
      raus: Math.round(Math.max(0, r.right - document.documentElement.clientWidth)),
      quer: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    };
  });
  console.log(`${String(w).padStart(4)}px  Hoehen ${d.hoehen.join(",")}  Zeilen ${d.zeilen}  ueberstehend ${d.raus}px  Querlauf ${d.quer}px`);
  await ctx.close();
}
await b.close();
