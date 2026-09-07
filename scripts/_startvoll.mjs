import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: B, viewport: { width: 1280, height: 1000 } });
await s.goto(`${B}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-sv-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 60000 });
await s.goto(`${B}/app`, { waitUntil: "domcontentloaded", timeout: 180000 });
await s.waitForTimeout(7000);
const d = await s.evaluate(() => ({
  teaser: Boolean(document.querySelector('a[href="/app/beitraege"]')),
  stimmen: document.querySelectorAll('section[aria-labelledby="stimmen"] li').length,
  sternfarbe: (() => { const st = document.querySelector('section[aria-labelledby="stimmen"] svg'); return st ? getComputedStyle(st).fill : "-"; })(),
  knopfFarbe: (() => { const b = [...document.querySelectorAll("a")].find(a => /Mit Monday sprechen/.test(a.textContent)); return b ? getComputedStyle(b).backgroundColor : "-"; })(),
}));
console.log(`News-Teaser: ${d.teaser} · Stimmen: ${d.stimmen} · Sternfarbe ${d.sternfarbe} · Hauptknopf ${d.knopfFarbe}`);
await s.screenshot({ path: "/tmp/start-voll.png", fullPage: false, clip: { x: 0, y: 180, width: 1280, height: 800 } });
await b.close();
