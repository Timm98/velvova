import { chromium } from "@playwright/test";

/**
 * Verliert der Studio-Editor getippten Text?
 *
 * Der Verdacht: Ein spätes Neuladen setzt ihn auf den Serverstand
 * zurück. Beobachtet wird der Inhalt über zehn Sekunden — nicht ein
 * einzelner Blick, sondern der Verlauf.
 */
const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-studio-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });

await s.goto(`${BASIS}/app/jobs`);
await s.waitForLoadState("networkidle");
/* Nicht der erste Link — `/app/jobs/import` steht ganz oben. Nur
   Links auf eine Kennung. */
const ersteStelle = s.locator('a[href^="/app/jobs/"]').filter({ hasNotText: "" }).first();
const kennung = await s.evaluate(() => {
  const a = [...document.querySelectorAll('a[href^="/app/jobs/"]')]
    .map((e) => e.getAttribute("href"))
    .find((h) => /\/app\/jobs\/[0-9a-f-]{36}$/.test(h ?? ""));
  return a ?? null;
});
if (!kennung) { console.log("keine Stelle in der Liste"); await b.close(); process.exit(0); }
await s.goto(`${BASIS}${kennung}`);
await s.waitForLoadState("networkidle");

const vorbereiten = s.getByRole("button", { name: /Bewerbung vorbereiten/i });
if (!(await vorbereiten.count())) {
  console.log("kein Knopf „Bewerbung vorbereiten“ — Seite:", (await s.locator("main").innerText()).slice(0, 150).replace(/\n+/g, " / "));
  await b.close(); process.exit(0);
}
await vorbereiten.click();
await s.waitForURL(/\/app\/applications\/[0-9a-f-]{36}/, { timeout: 30000 });
console.log("Bewerbung angelegt:", new URL(s.url()).pathname);

const erzeugen = s.getByRole("button", { name: /Kurze Bewerbungs-E-Mail/ });
if (!(await erzeugen.count())) {
  console.log("kein Erzeugen-Knopf:", (await s.locator("main").innerText()).slice(0, 200).replace(/\n+/g, " / "));
  await b.close(); process.exit(0);
}
await erzeugen.click();
const editor = s.locator("#artifact");
await editor.waitFor({ timeout: 60000 });
await s.waitForFunction(() => (document.querySelector("#artifact")?.value ?? "").length > 50, null, { timeout: 90000 })
  .catch(() => console.log("Dokument blieb leer"));
await s.waitForLoadState("networkidle");

const probe = `PRUEFTEXT-${Date.now()}`;
await editor.fill(probe);
console.log("getippt. Verlauf über zehn Sekunden:");
for (let i = 0; i < 10; i++) {
  const wert = await editor.inputValue();
  const knopf = s.getByRole("button", { name: "Speichern", exact: true });
  const aktiv = (await knopf.count()) ? await knopf.isEnabled() : null;
  console.log(`  ${String(i + 1).padStart(2)}s  Text ${wert === probe ? "steht" : "WEG "} · Knopf ${aktiv === null ? "fehlt" : aktiv ? "aktiv" : "inaktiv"}`);
  await s.waitForTimeout(1000);
}
await b.close();
