import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: B });
const fehler = [];
s.on("console", m => { if (m.type()==="error") fehler.push(m.text()); });
await s.goto(`${B}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-zahl-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });
await s.goto(`${B}/app/jobs`, { waitUntil: "domcontentloaded" });
await s.waitForTimeout(3000);
await s.locator(".zahlungsarten").scrollIntoViewIfNeeded();
await s.waitForTimeout(1500);
await s.evaluate(() => Promise.all([...document.querySelectorAll(".zahlungsbadge img")]
  .map(i => i.complete ? null : new Promise(r => { i.onload = r; i.onerror = r; }))));

for (const thema of ["light", "dark"]) {
  await s.evaluate((t) => document.documentElement.setAttribute("data-theme", t), thema);
  await s.waitForTimeout(400);
  const werte = await s.evaluate(() => {
    const badges = [...document.querySelectorAll(".zahlungsbadge")];
    return badges.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const bild = [...el.querySelectorAll("img")].find((i) => getComputedStyle(i).display !== "none");
      return {
        h: Math.round(r.height), w: Math.round(r.width),
        radius: cs.borderRadius, padding: cs.padding, rand: cs.borderColor,
        schatten: cs.boxShadow,
        bild: bild ? bild.getAttribute("src").split("/").pop() : "KEINS",
        geladen: bild ? bild.naturalWidth > 0 : false,
        fit: bild ? getComputedStyle(bild).objectFit : "-",
      };
    });
  });
  console.log(`\n── ${thema} ──`);
  for (const w of werte) console.log(`  ${String(w.h).padStart(3)}x${String(w.w).padStart(3)}px  r=${w.radius} p=${w.padding} fit=${w.fit} schatten=${w.schatten}  ${w.bild} geladen=${w.geladen}`);
  const hoehen = [...new Set(werte.map(w=>w.h))];
  console.log(`  einheitliche Hoehe: ${hoehen.length===1} (${hoehen.join(",")})`);
  const luecke = await s.evaluate(() => getComputedStyle(document.querySelector(".zahlungsarten")).gap);
  console.log(`  Abstand: ${luecke}`);
}
console.log("\nKonsolenfehler:", fehler.length);
await b.close();
