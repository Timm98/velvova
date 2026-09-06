import { chromium } from "@playwright/test";

/**
 * Trägt die Lebenshaltungsseite von Ende zu Ende?
 *
 * Der Kreis, der geschlossen sein muss: aktuelle Stelle eintragen →
 * Netto wird gerechnet → Kosten eintragen → „frei verfügbar" steht da.
 * Jeder Schritt einzeln funktioniert; die Frage ist, ob sie zusammen
 * funktionieren.
 */
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1200 }, locale: "de-DE" }).then((c) => c.newPage());

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`leben-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });

const pfad = `${B}/app/settings/lebenshaltung`;
await p.goto(pfad, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);

const vorher = (await p.locator("body").innerText()).replace(/\s+/g, " ");
console.log(`  ${/fehlt das Bruttogehalt/.test(vorher) ? "ok  " : "!!  "} sagt zuerst, was fehlt (statt einer Platzhalterzahl)`);

await p.getByLabel("Bruttogehalt").fill("63000");
await p.getByLabel("Arbeitsweg je Richtung").fill("35");
await p.getByRole("button", { name: /^Speichern$/ }).first().click();
await p.waitForTimeout(3000);

await p.goto(pfad, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);
const nachStelle = (await p.locator("body").innerText()).replace(/\s+/g, " ");
const netto = /Netto im Monat\s*([\d.]+)/.exec(nachStelle);
console.log(`  ${netto ? "ok  " : "!!  "} Netto wird gerechnet${netto ? `: ${netto[1]} €` : ""}`);
/*
 * Über den Feldwert prüfen, nicht über den Seitentext.
 *
 * Die erste Fassung suchte „63000" im sichtbaren Text — Eingabefelder
 * tragen ihren Wert aber im `value`, nicht im Text. Der Test meldete
 * deshalb einen Fehler, den es nicht gab, und verdeckte dabei fast den
 * echten daneben.
 */
const gespeichert = await p.getByLabel("Bruttogehalt").inputValue();
console.log(`  ${gespeichert === "63000" ? "ok  " : "!!  "} Bruttogehalt bleibt gespeichert (${gespeichert || "leer"})`);

const felder = p.locator('input[aria-label="Wohnen je Monat in Euro"]');
if (await felder.count() > 0) {
  await felder.fill("1200");
  await p.locator('input[aria-label="Lebensmittel je Monat in Euro"]').fill("400");
  await p.waitForTimeout(700);
  const mitKosten = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  const frei = /Frei verfügbar\s*([\d.]+)/.exec(mitKosten);
  console.log(`  ${frei ? "ok  " : "!!  "} „Frei verfügbar" rechnet sofort mit${frei ? `: ${frei[1]} €` : ""}`);
  console.log(`  ${/Nicht angegeben:/.test(mitKosten) ? "ok  " : "!!  "} nennt die fehlenden Posten`);
}
await p.screenshot({ path: "artifacts/life-fit/lebenshaltung.png", fullPage: true });
await b.close();
