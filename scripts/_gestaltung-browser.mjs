import { chromium } from "@playwright/test";

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS, viewport: { width: 1440, height: 900 } });
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-gest-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });

await s.goto(`${BASIS}/app/jobs`, { timeout: 120000 });
await s.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
const t = await s.locator("body").innerText();

for (const [name, muster] of [
  ["App-Hinweisleiste", /App kommt bald/i],
  ["Vier Karten", /Alles für deinen nächsten Karriereschritt/i],
  ["Berufsfelder", /Berufsfelder mit den meisten offenen Stellen/i],
  ["Vertrauensbereich", /braucht mehr als eine Stellenanzeige/i],
  ["Footer-Spalten", /Karriere-Tools/i],
  ["Märkte", /Deutschland · EUR/i],
  ["keine Fake-Social", /Noch keine Kanäle/i],
]) {
  console.log(`${name.padEnd(22)} ${muster.test(t) ? "da" : "FEHLT"}`);
}

const felder = t.match(/([A-ZÄÖÜ][^\n]{6,50})\n[\d.]+ Stellen/g) ?? [];
console.log("\nBerufsfelder gefunden:", felder.length);
console.log("  " + felder.slice(0, 4).map((f) => f.replace(/\n/, " → ")).join(" · ").slice(0, 200));

/* Schließen der Leiste merkt sich */
const zu = s.getByRole("button", { name: /Hinweis schliessen/i });
console.log("\nSchliessknopf gefunden:", await zu.count());
if (await zu.count()) {
  await zu.click();
  await s.waitForTimeout(800);
  console.log("localStorage:", await s.evaluate(() => window.localStorage.getItem("paycheck_apphinweis_zu")));
  await s.reload();
  await s.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
  /* Am Schliessknopf erkennen, nicht am Text — „App kommt bald" steht
     auch im Fussbereich, und danach zu suchen prüfte das Falsche. */
  const nachher = await s.getByRole("button", { name: /Hinweis schliessen/i }).count();
  console.log("\nnach Schliessen und Neuladen wieder da:", nachher > 0);
}
await b.close();
