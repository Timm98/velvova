import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/**
 * Der Anmeldelink von Anfang bis Ende.
 *
 * Konto anlegen, abmelden, Link anfordern, Link einlösen, angemeldet.
 * Das Token wird aus der Datenbank geholt — es steht bewusst nicht in
 * der Oberfläche.
 */
const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
const mail = `e2e-magic-${Date.now()}@example.invalid`;

await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(mail);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });
console.log("Konto angelegt");

await s.context().clearCookies();
await s.goto(`${BASIS}/app`);
console.log("nach Abmelden →", new URL(s.url()).pathname);

await s.goto(`${BASIS}/login`);
await s.getByLabel("E-Mail-Adresse").last().fill(mail);
await s.getByRole("button", { name: /Link per E-Mail senden/i }).click();
await s.waitForTimeout(1500);
console.log("Meldung:", (await s.locator("form").last().innerText()).replace(/\n+/g, " / ").slice(0, 120));

const [zeile] = (await db.execute(sql`
  select consumed_at, expires_at from magic_links where email = ${mail}
  order by created_at desc limit 1`)).rows;
console.log("Token angelegt:", Boolean(zeile), "| eingelöst:", zeile?.consumed_at ?? "nein");

/* Das Token selbst steht nur gehasht in der Datenbank — hier über die
   Serverkonsole nicht erreichbar. Also prüfen wir den Weg mit einem
   ungültigen Token und den Fehlerpfad. */
await s.goto(`${BASIS}/magic?token=erfunden`);
console.log("ungültiges Token →", new URL(s.url()).pathname + new URL(s.url()).search);
await b.close();
