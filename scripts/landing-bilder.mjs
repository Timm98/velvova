import { chromium } from "@playwright/test";

/**
 * Die QA-Bilder der Landingpage.
 *
 * Sie entstehen nicht zur Dekoration: Eine Landingpage beurteilt man
 * ansehend, nicht lesend. Was hier fehlt oder schief steht, sieht man
 * in keinem Test.
 */
const B = "http://localhost:3000";
const b = await chromium.launch();

async function schuss(pfad, datei, { breite = 1440, hoehe = 1000, anker, voll = false } = {}) {
  const p = await b
    .newContext({ viewport: { width: breite, height: hoehe }, locale: "de-DE" })
    .then((c) => c.newPage());
  await p.goto(`${B}${pfad}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2200);
  if (anker) {
    const el = p.getByRole("heading", { name: anker }).first();
    await el.scrollIntoViewIfNeeded();
    await p.waitForTimeout(700);
  }
  await p.screenshot({ path: `artifacts/landing/${datei}`, fullPage: voll });
  console.log(`  ${datei}`);
  await p.close();
}

await schuss("/", "landing-desktop-top.png");
await schuss("/", "landing-desktop-discovery.png", { anker: /nie gesucht hättest/ });
await schuss("/", "landing-desktop-life-fit.png", { anker: /was bleibt dir/i });
await schuss("/", "landing-desktop-business.png", { anker: /sucht auch für dich/ });
await schuss("/", "landing-mobile-top.png", { breite: 390, hoehe: 844 });
await schuss("/", "landing-mobile-business.png", { breite: 390, hoehe: 844, anker: /sucht auch für dich/ });
await schuss("/for-business", "business-landing.png");
await schuss("/for-business", "business-landing-trust.png", { anker: /bleiben privat/ });
await schuss("/register?absicht=unternehmen", "register-choice.png", { breite: 900, hoehe: 900 });

await b.close();
