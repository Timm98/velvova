import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1280, height: 1400 }, locale: "de-DE" }).then((c) => c.newPage());
p.setDefaultTimeout(90000);
await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`shot-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });
await p.goto(`${B}/business/einrichten`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
await p.getByLabel("Name des Unternehmens").fill("Ostwind GmbH");
await p.getByRole("button", { name: /^Anlegen$/ }).click();
await p.waitForURL(/\/business$/, { timeout: 60000 });
await p.goto(`${B}/business/stellen`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
await p.getByRole("button", { name: /Neue Stelle/ }).click();
await p.getByLabel("Titel der Stelle").fill("Sachbearbeiter");
await p.getByRole("button", { name: /^Anlegen$/ }).click();
await p.waitForURL(/\/business\/stellen\/[0-9a-f-]{36}/, { timeout: 60000 });
await p.getByLabel("Ort", { exact: true }).fill("Bochum");
await p.getByLabel("Beschreibung").fill(
  "Für unser Büro in Bochum suchen wir Verstärkung in der Sachbearbeitung. Du bearbeitest " +
  "Aufträge, pflegst Stammdaten und stimmst dich mit dem Vertrieb ab. Wir sind ein junges, " +
  "dynamisches Team und freuen uns auf dich. Deutsch auf Muttersprachlerniveau setzen wir voraus.",
);
await p.waitForTimeout(800);
const h = p.getByRole("heading", { name: "Was noch fehlt" }).first();
await h.scrollIntoViewIfNeeded();
await p.waitForTimeout(400);
const box = await h.boundingBox();
await p.screenshot({
  path: "/Users/timenseling/paycheck-rebuild/artifacts/business/anzeigenpruefung.png",
  clip: { x: Math.max(0, box.x - 24), y: Math.max(0, box.y - 24), width: 820, height: 720 },
});
await b.close();
