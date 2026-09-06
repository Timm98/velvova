import { chromium } from "@playwright/test";

/**
 * Die Navigation nach der Überarbeitung.
 *
 * Geprüft wird, was sich messen lässt: Breite, Kante statt Schatten,
 * kein Weichzeichner, und ob die Ausrichtung zwischen Kopfzeile,
 * Inhalt und Fussbereich stimmt.
 */
const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS, viewport: { width: 1600, height: 900 } });
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-nav-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });
await s.goto(`${BASIS}/app/belege`);
await s.waitForLoadState("networkidle");

const kopf = await s.locator("header").first().evaluate((e) => {
  const c = getComputedStyle(e);
  const innen = e.firstElementChild;
  return {
    hoehe: e.getBoundingClientRect().height,
    rand: c.borderBottomWidth,
    filter: c.backdropFilter,
    schatten: c.boxShadow,
    innenBreite: innen ? innen.getBoundingClientRect().width : 0,
    innenLinks: innen ? Math.round(innen.getBoundingClientRect().left) : 0,
  };
});
const inhalt = await s.locator("main").evaluate((e) => ({
  breite: e.getBoundingClientRect().width,
  links: Math.round(e.getBoundingClientRect().left),
}));
const fuss = await s.locator("footer div").first().evaluate((e) => ({
  breite: e.getBoundingClientRect().width,
  links: Math.round(e.getBoundingClientRect().left),
})).catch(() => null);

console.log("Kopfzeile:");
console.log(`  Höhe ${kopf.hoehe} px · untere Kante ${kopf.rand} · Weichzeichner ${kopf.filter} · Schatten ${kopf.schatten.slice(0, 20)}`);
console.log(`  Inhaltsbreite ${Math.round(kopf.innenBreite)} px, linke Kante ${kopf.innenLinks}`);
console.log(`Hauptbereich: ${Math.round(inhalt.breite)} px, linke Kante ${inhalt.links}`);
if (fuss) console.log(`Fussbereich:  ${Math.round(fuss.breite)} px, linke Kante ${fuss.links}`);
console.log(`\nbündig: ${kopf.innenLinks === inhalt.links && (!fuss || fuss.links === inhalt.links)}`);
await b.close();
