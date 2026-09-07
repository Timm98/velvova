import { chromium } from "@playwright/test";

/**
 * Der Beweis für die Kette, die gefehlt hat.
 *
 * Jemand nennt Monday eine Gehaltsuntergrenze. Bis vor kurzem endete das
 * im Gesprächsverlauf: `user_constraints` blieb leer, und die Jobseite
 * schrieb „Du hast keine Untergrenze festgelegt".
 *
 * Geprüft wird deshalb nicht, ob eine Komponente rendert, sondern ob
 * die Angabe ankommt:
 *
 *   1. Satz mit einer Grenze im Gespräch
 *   2. Der Vorschlag erscheint MIT dem Satz als Beleg
 *   3. Vor der Bestätigung gilt er NICHT — eine harte Bedingung, die
 *      sich nebenbei setzt, wäre der schlimmere Fehler
 *   4. Nach der Bestätigung steht sie als Bedingung da
 *   5. Auf der Jobseite ist sie sichtbar und wird angewendet
 *   6. Aufheben wirkt
 *
 *   node scripts/bedingung-beweis.mjs [basis-url]
 */

const B = process.argv[2] ?? "http://localhost:3000";
const schritte = [];
const merke = (ok, text) => {
  schritte.push({ ok, text });
  console.log(`  ${ok ? "ok " : "!! "} ${text}`);
};

const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1000 } }).then((c) => c.newPage());
const jsFehler = [];
p.on("pageerror", (e) => jsFehler.push(e.message.slice(0, 200)));

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`bed-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 40000 });

// ── 1. Die Grenze aussprechen ───────────────────────────────────
await p.goto(`${B}/app/monday`, { waitUntil: "networkidle" });
const feld = p.getByRole("textbox").first();
await feld.fill("Mindestens 52000 Euro brutto im Jahr, darunter lohnt es sich für mich nicht.");
await feld.press("Enter");
await p.waitForTimeout(9000);

const flaeche = p.locator("[data-bedingungen]").first();
const karte = p.locator("li").filter({ hasText: "52.000 € brutto im Jahr" }).first();
merke(await karte.isVisible().catch(() => false), "Vorschlag erscheint im Gespräch");
merke(
  (await flaeche.innerText().catch(() => "")).includes("52000"),
  "der eigene Satz steht als Beleg daneben",
);

// ── 2. Vor der Bestätigung gilt sie nicht ───────────────────────
const vorher = await p.evaluate(async () => {
  const r = await fetch("/api/debug/constraints").catch(() => null);
  return r && r.ok ? await r.text() : "kein-endpunkt";
});
merke(
  !(await flaeche.innerText().catch(() => "")).includes("Diese Grenzen wende ich an"),
  "vor der Bestätigung ist sie noch keine Bedingung",
);

// ── 3. Bestätigen ───────────────────────────────────────────────
await p.getByRole("button", { name: /Als Bedingung setzen/i }).first().click();
await p.waitForTimeout(4000);
const nachText = await flaeche.innerText().catch(() => "");
merke(nachText.includes("Übernommen"), "die Bestätigung wird bestätigt");
merke(nachText.includes("52.000"), "die Bedingung steht jetzt als gesetzt da");

// ── 4. Auf der Jobseite ─────────────────────────────────────────
await p.goto(`${B}/app/jobs`, { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
/*
 * Die Kennung darf aus beiden Gruppen kommen.
 *
 * Sobald eine Gehaltsgrenze gilt, ist die Hauptliste oft leer — die
 * meisten Anzeigen nennen kein Gehalt und stehen im Klärungsabschnitt.
 * Ein Prüfskript, das nur die Hauptliste kennt, meldet dann einen
 * Fehler, wo genau das erwartete Verhalten eingetreten ist.
 */
const id = await p
  .locator("[data-job-id]")
  .first()
  .getAttribute("data-job-id")
  .catch(() => null);

merke(Boolean(id), "eine Stelle ist erreichbar (Hauptliste oder Klärungsabschnitt)");

if (id) {
  await p.goto(`${B}/app/jobs/${id}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  const seite = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  merke(seite.includes("Deine Bedingungen an dieser Stelle"), "Bedingungsprüfung ist auf der Stelle sichtbar");
  merke(
    !seite.includes("Du hast keine Untergrenze festgelegt"),
    "der Satz „keine Untergrenze festgelegt“ ist weg",
  );
  merke(
    /erfüllt|verletzt|steht nicht in der Anzeige/.test(seite),
    "jede Bedingung trägt ihren Zustand als Wort",
  );
  // Unbekannt darf nicht wie erfüllt aussehen: das Wort muss dastehen.
  merke(
    !/Gehalt · erfüllt/.test(seite) || !/nennt kein Gehalt/.test(seite),
    "eine Stelle ohne Gehaltsangabe wird nicht als „erfüllt“ ausgegeben",
  );
  merke(!/Original ansehen|Original öffnen/.test(seite), "„Original“ verspricht nicht mehr die Arbeitgeberseite");
}

// ── 5. Aufheben ─────────────────────────────────────────────────
await p.goto(`${B}/app/monday`, { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
const weg = p.getByRole("button", { name: /Bedingung .* aufheben/i }).first();
if (await weg.isVisible().catch(() => false)) {
  await weg.click();
  await p.waitForTimeout(3500);
  const rest = await p.locator("body").innerText();
  merke(!rest.includes("52.000 € brutto im Jahr"), "Aufheben entfernt die Bedingung wieder");
} else {
  merke(false, "kein Knopf zum Aufheben gefunden");
}

merke(jsFehler.length === 0, `keine JS-Fehler${jsFehler.length ? `: ${jsFehler[0]}` : ""}`);

const schlecht = schritte.filter((s) => !s.ok).length;
console.log(schlecht === 0 ? "\nDie Kette hält." : `\n${schlecht} Schritt(e) halten nicht.`);
await b.close();
process.exit(schlecht === 0 ? 0 : 1);
