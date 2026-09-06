import { chromium } from "@playwright/test";

/**
 * Die Belegkette im laufenden Produkt.
 *
 * Konto anlegen → Arbeitsprobe lösen → Beleg steht als „beobachtet" da.
 * Geprüft wird nicht der Code, sondern was jemand sieht.
 */
const BASIS = "http://localhost:3000";
const browser = await chromium.launch();
const seite = await browser.newPage({ baseURL: BASIS });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));

const mail = `e2e-belege-${Date.now()}@example.invalid`;
await seite.goto(`${BASIS}/register`);
await seite.getByLabel("E-Mail-Adresse").fill(mail);
await seite.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await seite.getByRole("button", { name: /Konto anlegen/i }).click();
await seite.waitForURL(/\/(app|setup)/, { timeout: 45000 });
console.log("angemeldet als", mail, "→", new URL(seite.url()).pathname);

await seite.goto(`${BASIS}/app/belege`);
await seite.getByRole("heading", { name: /Was du belegen kannst/i }).waitFor({ timeout: 20000 });
console.log("\nLEER");
console.log("─".repeat(60));
console.log((await seite.locator("main").innerText()).trim().slice(0, 400));

await seite.goto(`${BASIS}/app/proben`);
await seite.waitForLoadState("networkidle");

/*
 * Die bewertete Aufgabe, nicht die erste auf der Seite.
 *
 * Oben steht eine Textaufgabe — dort wird nichts bewertet, und genau
 * daraus darf kein beobachteter Beleg entstehen. Geprüft wird die
 * Aufgabe mit Auswahlmöglichkeiten.
 */
const karten = seite.locator("main").locator("h2");
const titel = await karten.allInnerTexts();
console.log("\nProben auf der Seite:", titel.join(" | ").slice(0, 200));

const optionen = seite.locator("main button[aria-pressed]");
let gemacht = false;
if (await optionen.count() >= 2) {
  /* Reihenfolge: alle anklicken. Auswahl: eine genügt, mehr geht nicht. */
  const n = await optionen.count();
  for (let i = 0; i < n; i++) await optionen.nth(i).click();
  const weiter = seite.getByRole("button", { name: "Weiter" });
  console.log("Weiter aktiv:", await weiter.isEnabled());
  await weiter.click();
  await seite.getByText(/Wie hat sich das angefühlt/i).waitFor({ timeout: 8000 });
  const energie = seite.locator("fieldset button");
  console.log("Energiestufen:", await energie.allInnerTexts());
  /* Die letzte Stufe: „gibt Energie" — damit der Satz beide Teile trägt. */
  await energie.nth((await energie.count()) - 1).click();
  await seite.getByText(/So geht man üblicherweise|Nochmal|üblich/i).first().waitFor({ timeout: 20000 });
  gemacht = true;
  console.log("abgegeben:", (await seite.locator("main").innerText()).replace(/\n+/g, " / ").slice(-320));
}
if (!gemacht) console.log("keine bewertete Probe gefunden");

await seite.goto(`${BASIS}/app/belege`);
await seite.getByRole("heading", { name: /Was du belegen kannst/i }).waitFor({ timeout: 20000 });
console.log("\nNACH DER PROBE");
console.log("─".repeat(60));
console.log((await seite.locator("main").innerText()).trim().slice(0, 900));

const haken = seite.getByRole("checkbox", { name: /Arbeitgebern zeigen/i }).first();
if (await haken.count()) {
  await haken.check();
  await seite.waitForTimeout(1200);
  await seite.reload();
  await seite.getByRole("heading", { name: /Was du belegen kannst/i }).waitFor({ timeout: 20000 });
  const nachher = seite.getByRole("checkbox", { name: /Arbeitgebern zeigen/i }).first();
  console.log("\nFreigabe h\u00e4lt nach Neuladen:", await nachher.isChecked());
} else {
  console.log("\nkein Freigabe-Haken gefunden");
}

console.log("\nFehler:", fehler.length ? fehler.slice(0, 3) : "keine");
await browser.close();
