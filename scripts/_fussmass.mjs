import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: B, viewport: { width: 1280, height: 900 } });
await s.goto(`${B}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-mass-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 60000 });
await s.goto(`${B}/app/jobs`, { waitUntil: "domcontentloaded", timeout: 120000 });
await s.waitForTimeout(2500);
await s.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await s.waitForTimeout(1500);
const d = await s.evaluate(() => {
  const navs = [...document.querySelectorAll("footer nav")];
  const spalten = navs.map((n) => {
    const links = [...n.querySelectorAll("a")];
    const oben = links.map((a) => Math.round(a.getBoundingClientRect().top));
    const abst = oben.slice(1).map((v, i) => v - oben[i]);
    return { titel: n.getAttribute("aria-label"), erster: oben[0], abstaende: [...new Set(abst)] };
  });
  const f = document.querySelector("footer").getBoundingClientRect();
  const body = getComputedStyle(document.body).backgroundColor;
  const html = getComputedStyle(document.documentElement).backgroundColor;
  return {
    spalten,
    fussUnten: Math.round(f.bottom),
    fensterUnten: Math.round(innerHeight),
    dokumentHoehe: Math.round(document.documentElement.scrollHeight),
    body, html,
  };
});
for (const sp of d.spalten) console.log(`${String(sp.titel).padEnd(20)} erster ${sp.erster}  Abstaende ${sp.abstaende.join(",")}`);
console.log(`\nFuss endet bei ${d.fussUnten}, Fenster ${d.fensterUnten}, Dokument ${d.dokumentHoehe}`);
console.log(`body ${d.body} · html ${d.html}`);
await b.close();
