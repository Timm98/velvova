import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: B });

/* 1. Als Gast suchen. */
await s.goto(`${B}/jobs?q=Pflegefachkraft&ort=Berlin`, { waitUntil: "domcontentloaded" });
const karten = await s.locator("ul > li > a").count();
console.log(`Treffer als Gast: ${karten}`);

/* 2. Auf die erste Anzeige klicken. */
const ziel = await s.locator("ul > li > a").first().getAttribute("href");
console.log(`Ziel der ersten Karte: ${ziel}`);
await s.locator("ul > li > a").first().click();
await s.waitForURL(/\/login|\/app\/jobs/, { timeout: 20000 });
console.log(`Nach dem Klick: ${new URL(s.url()).pathname}${new URL(s.url()).search}`);

/* 3. Registrieren — der Login-Weg braucht ein Konto, also legen wir eins an
      und melden uns danach neu an, um genau den Login-Pfad zu pruefen. */
const mail = `e2e-rueck-${Date.now()}@example.invalid`;
await s.goto(`${B}/register`);
await s.getByLabel("E-Mail-Adresse").fill(mail);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });

/* 4. Abmelden und den Gastweg noch einmal gehen. */
await s.context().clearCookies();
await s.goto(`${B}/jobs?q=Pflegefachkraft&ort=Berlin`, { waitUntil: "domcontentloaded" });
await s.locator("ul > li > a").first().click();
await s.waitForURL(/\/login/, { timeout: 20000 });
const loginUrl = new URL(s.url());
console.log(`Login mit Ziel: ${loginUrl.searchParams.get("weiter") ?? "KEINS"}`);

/* 5. Anmelden und pruefen, wo wir landen. */
await s.getByLabel(/E-Mail/i).first().fill(mail);
await s.getByLabel(/Passwort/i).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Anmelden/i }).first().click();
await s.waitForURL(/\/app/, { timeout: 45000 });
console.log(`Nach dem Anmelden: ${new URL(s.url()).pathname}`);
console.log(ziel && new URL(s.url()).pathname === ziel ? "✓ zurueck bei der Anzeige" : "✗ Anzeige verloren");
await b.close();
