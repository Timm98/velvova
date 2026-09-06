import { chromium } from "@playwright/test";

/**
 * Ändert „Annahmen ändern" die Zahl darüber?
 *
 * Unter der Nettoschätzung stand seit jeher ein Link zu den
 * Steuerangaben. Die Schätzung selbst las diese Angaben nicht — sie
 * rechnete immer mit Steuerklasse I, kinderlos, ohne Kirchensteuer.
 * Der Link war ein Versprechen ohne Leitung dahinter, und zwar bei der
 * Zahl, an der jemand seine Miete misst.
 *
 * Dieser Test macht das Versprechen prüfbar.
 */
const B = "http://localhost:3000";
const JOB = process.argv[2] ?? "8530a5ed-128a-418f-95ac-a286a1235d7f";

const b = await chromium.launch();
const p = await b
  .newContext({ viewport: { width: 1440, height: 1400 }, locale: "de-DE" })
  .then((c) => c.newPage());
p.setDefaultTimeout(90000);
p.setDefaultNavigationTimeout(90000);
const text = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");
const zeile = (s, m) => console.log(`  ${s ? "ok  " : "!!  "} ${m}`);
const netto = async () => {
  const m = /bleiben dir etwa ([\d.]+) €/.exec(await text());
  return m ? Number(m[1].replace(/\./g, "")) : null;
};

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
const konto = `annahmen-${Date.now()}@example.invalid`;
await p.getByLabel("E-Mail-Adresse").fill(konto);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });
console.log(`  Konto: ${konto}`);

await p.goto(`${B}/app/jobs/${JOB}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
const vorher = await netto();
const pillenVorher = await text();
zeile(vorher !== null, `Netto mit Voreinstellung: ${vorher} €`);
zeile(/Steuerklasse I\b/.test(pillenVorher), "Die Voreinstellung wird als Annahme ausgewiesen");
zeile(
  /Voreinstellung, keine Auskunft/.test(pillenVorher),
  "Sagt, dass es eine Voreinstellung ist und nicht die eigene Lage",
);

// ── Angaben ändern: Steuerklasse III, zwei Kinder ──
await p.goto(`${B}/app/settings/gehalt`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2000);
await p.getByLabel("Steuerklasse", { exact: true }).selectOption("3");
const kinder = p.locator('input[name="kinderzahl"]');
if (await kinder.count()) await kinder.first().fill("2").catch(() => {});
const speichern = p.locator('input[name="speichern"], input[type="checkbox"][name="speichern"]');
if (await speichern.count()) await speichern.first().check().catch(() => {});
await p.getByRole("button", { name: /Übernehmen/i }).first().click();
await p.waitForTimeout(3000);

await p.goto(`${B}/app/jobs/${JOB}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
const nachher = await netto();
const pillenNachher = await text();
zeile(nachher !== null, `Netto mit Steuerklasse III: ${nachher} €`);
zeile(
  vorher !== null && nachher !== null && nachher > vorher,
  `Die Zahl folgt den Angaben (${vorher} € → ${nachher} €)`,
);
zeile(/Steuerklasse III/.test(pillenNachher), "Die Pillen nennen die eigenen Angaben");
zeile(
  /Basis deiner hinterlegten Angaben/.test(pillenNachher),
  "Der Satz darunter sagt, worauf gerechnet wurde",
);
await p.screenshot({ path: "artifacts/life-fit/annahmen.png", fullPage: false });
await b.close();
