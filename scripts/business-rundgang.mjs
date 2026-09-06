import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";

/**
 * Jede Adresse des Arbeitgeberbereichs mit einem frischen, ganz
 * gewöhnlichen Konto.
 *
 * Genau so wurde früher gefunden, dass zwei Seiten unter `/admin` mit
 * 200 antworteten statt mit 404. Eine Berechtigungslücke sieht man nicht
 * beim Lesen des Codes — man sieht sie, wenn man die Adresse aufruft.
 */
const B = "http://localhost:3000";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const [org] = (await db.execute(sql`SELECT id FROM organizations WHERE kind = 'employer' LIMIT 1`)).rows;
const [posting] = (await db.execute(sql`SELECT id FROM job_postings LIMIT 1`)).rows;
const [einladung] = (await db.execute(
  sql`SELECT token_hash FROM organization_invitations LIMIT 1`,
)).rows;

const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: "de-DE" }).then((c) => c.newPage());
p.setDefaultTimeout(60000);
p.setDefaultNavigationTimeout(60000);

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
const konto = `rundgang-${Date.now()}@example.invalid`;
await p.getByLabel("E-Mail-Adresse").fill(konto);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });
console.log(`  Frisches Konto: ${konto}`);
console.log(`  Fremde Organisation: ${org?.id}\n`);

const ADRESSEN = [
  ["/business", "leitet auf Einrichtung"],
  ["/business/einrichten", "darf jeder sehen"],
  [`/business?org=${org?.id}`, "fremde Organisation"],
  ["/business/stellen", "leitet auf Einrichtung"],
  [`/business/stellen?org=${org?.id}`, "fremde Stellen"],
  [`/business/stellen/${posting?.id}`, "fremde Stelle"],
  ["/business/bewerbungen", "leitet auf Einrichtung"],
  [`/business/bewerbungen?org=${org?.id}`, "fremde Bewerbungen"],
  ["/business/team", "leitet auf Einrichtung"],
  [`/business/team?org=${org?.id}`, "fremdes Team"],
  ["/business/einladung/erfunden123", "erfundene Einladung"],
  ["/admin/organisationen", "Betriebsbereich"],
];

let durchgefallen = 0;
for (const [pfad, was] of ADRESSEN) {
  const antwort = await p.goto(`${B}${pfad}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(900);
  const code = antwort?.status() ?? 0;
  const t = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  const url = new URL(p.url()).pathname;

  /*
   * Was als „dicht" gilt.
   *
   * Entweder 404, oder die Umleitung auf die Einrichtung, oder — bei
   * der Einladungsseite — eine Seite ohne fremde Daten. NICHT dicht ist
   * alles, wo der Name der fremden Organisation auftaucht.
   */
  const zeigtFremdes = /Nordwind GmbH/.test(t);
  const dicht =
    code === 404 ||
    url === "/business/einrichten" ||
    (pfad.startsWith("/business/einladung") && !zeigtFremdes) ||
    (pfad === "/business/einrichten" && !zeigtFremdes);

  if (!dicht) durchgefallen++;
  console.log(
    `  ${dicht ? "ok  " : "!!  "} ${String(code).padEnd(3)} → ${url.padEnd(28)} ${was}${zeigtFremdes ? "  ← FREMDE DATEN" : ""}`,
  );
}

/*
 * Der realistischere Angriff: jemand MIT eigener Organisation.
 *
 * Ohne eigene Mitgliedschaft landet man auf der Einrichtung — das
 * verdeckt, ob der Zugriffsschutz greift oder nur der Leerzustand. Wer
 * selbst ein Arbeitgeberkonto hat, kommt am Leerzustand vorbei und
 * trifft auf die eigentliche Prüfung.
 */
console.log("\n  Mit eigener Organisation:");
await p.goto(`${B}/business/einrichten`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1000);
await p.getByLabel("Name des Unternehmens").fill("Suedwind AG");
await p.getByRole("button", { name: /^Anlegen$/ }).click();
await p.waitForURL(/\/business$/, { timeout: 60000 });
await p.waitForTimeout(1500);

for (const [pfad, was] of [
  [`/business?org=${org?.id}`, "fremde Übersicht"],
  [`/business/stellen?org=${org?.id}`, "fremde Stellen"],
  [`/business/bewerbungen?org=${org?.id}`, "fremde Bewerbungen"],
  [`/business/team?org=${org?.id}`, "fremdes Team"],
  [`/business/stellen/${posting?.id}`, "fremde Stelle direkt"],
]) {
  const antwort = await p.goto(`${B}${pfad}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(900);
  const code = antwort?.status() ?? 0;
  const t = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  const zeigtFremdes = /Nordwind GmbH|Carla Berg|Disponent \(m\/w\/d\)/.test(t);
  const dicht = code === 404 && !zeigtFremdes;
  if (!dicht) durchgefallen++;
  console.log(
    `  ${dicht ? "ok  " : "!!  "} ${String(code).padEnd(3)} ${was}${zeigtFremdes ? "  ← FREMDE DATEN" : ""}`,
  );
}

console.log(`\n  ${durchgefallen === 0 ? "Alle Adressen dicht." : `${durchgefallen} Adresse(n) undicht!`}`);
await b.close();
process.exit(durchgefallen === 0 ? 0 : 1);
