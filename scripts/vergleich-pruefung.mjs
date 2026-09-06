import { chromium } from "@playwright/test";

/**
 * Steht der Vergleich — und führt er niemanden in die Irre?
 *
 * Die wichtigere Hälfte ist die zweite: Eine fehlende Angabe darf nicht
 * wie eine schlechte aussehen, und es darf keine Gesamtnote geben, die
 * aus Gewichten entsteht, die niemand gewählt hat.
 */
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1600 }, locale: "de-DE" }).then((c) => c.newPage());
p.setDefaultTimeout(90000);
p.setDefaultNavigationTimeout(90000);
const text = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");
const zeile = (s, m) => console.log(`  ${s ? "ok  " : "!!  "} ${m}`);

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
const konto = `vgl-${Date.now()}@example.invalid`;
await p.getByLabel("E-Mail-Adresse").fill(konto);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });
console.log(`  Konto: ${konto}`);

// ── Ohne gemerkte Stellen ──
await p.goto(`${B}/app/jobs/vergleich`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);
const leer = await text();
zeile(/noch keine Stellen gespeichert/.test(leer), "Ohne gespeicherte Stellen: sagt, was zu tun ist");
zeile(!/Netto im Monat/.test(leer), "Und zeigt keine leere Tabelle");

// ── Zwei Stellen merken ──
const ids = process.argv.slice(2, 4);
for (const id of ids) {
  await p.goto(`${B}/app/jobs/${id}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  // Der Knopf heisst „Speichern", nicht „Merken" — nachgesehen in de.ts.
  const knopf = p.getByRole("button", { name: /^Speichern$/ }).first();
  if (await knopf.count()) { await knopf.click(); await p.waitForTimeout(1500); }
}

await p.goto(`${B}/app/jobs/vergleich?ids=${ids.join(",")}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
const t = await text();
zeile(/Netto im Monat/.test(t), "Die Tabelle steht");
zeile(/Netto je Arbeitsstunde/.test(t), "Der Stundenwert ist eine eigene Zeile");
zeile(/Genannte Leistungen/.test(t), "Die Leistungen stehen nebeneinander");
zeile(/nicht angegeben|nicht beziffert|keine genannt|keine Fahrzeit/.test(t),
  "Lücken sind ausgeschrieben, nicht leer");
zeile(!/Gesamtnote|Gesamtwertung|Gesamtpunkte/.test(t), "Es gibt keine Gesamtnote");
zeile(/aktuelle Stelle fehlt in diesem Vergleich/.test(t),
  "Ohne eigene Stelle: weist darauf hin, dass die dritte Möglichkeit fehlt");

const spalten = await p.locator("table thead th").count();
zeile(spalten === 3, `Zwei Stellen ergeben zwei Wertspalten (${spalten - 1})`);

// ── Jetzt mit eigener Stelle ──
await p.goto(`${B}/app/settings/lebenshaltung`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);
await p.getByLabel("Bruttogehalt").fill("63000");
await p.getByLabel("Wochenstunden").fill("35");
await p.getByLabel("Arbeitsweg je Richtung").fill("35");
await p.getByLabel("Bürotage je Woche").fill("3");
await p.getByRole("button", { name: /^Speichern$/ }).first().click();
await p.waitForTimeout(3000);

await p.goto(`${B}/app/jobs/vergleich?ids=${ids.join(",")}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
const t2 = await text();
/*
 * Ohne Rücksicht auf Gross-/Kleinschreibung.
 *
 * Die Kopfzeile trägt `uppercase` als CSS. `innerText` liefert den
 * GERENDERTEN Text, also „DEINE JETZIGE" — die erste Fassung dieser
 * Prüfung meldete deshalb einen Fehler, den es nicht gab.
 */
zeile(/deine jetzige/i.test(t2), "Die eigene Stelle steht als eigene Spalte daneben");
zeile(!/aktuelle Stelle fehlt in diesem Vergleich/.test(t2), "Der Hinweis ist verschwunden");
const gespeichert = await p.locator("fieldset input[type=checkbox]").count();
zeile(gespeichert === 2, `Die gespeicherten Stellen stehen zur Auswahl (${gespeichert})`);
const spalten2 = await p.locator("table thead th").count();
zeile(spalten2 === 4, `Jetzt drei Wertspalten (${spalten2 - 1})`);
const haken = await p.locator("table svg").count();
zeile(haken > 0, `Beste Werte sind markiert (${haken} Häkchen)`);
zeile(/35 Min/.test(t2), "Der eigene Arbeitsweg steht in der Zeile");

await p.screenshot({ path: "artifacts/life-fit/vergleich.png", fullPage: true });
await b.close();
