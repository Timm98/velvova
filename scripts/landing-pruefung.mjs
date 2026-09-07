import { chromium } from "@playwright/test";

/**
 * Führt kein Knopf ins Leere?
 *
 * Der Auftrag sagt es ausdrücklich: „Button darf NICHT ins Leere
 * führen." Ein toter Verweis auf einer Landingpage ist der teuerste
 * Fehler der Seite — er trifft genau die Person, die gerade
 * entschieden hatte, weiterzugehen.
 */
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" }).then((c) => c.newPage());
p.setDefaultTimeout(60000);
p.setDefaultNavigationTimeout(60000);
const zeile = (s, m) => console.log(`  ${s ? "ok  " : "!!  "} ${m}`);
let schlecht = 0;

for (const seite of ["/", "/for-business"]) {
  await p.goto(`${B}${seite}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);
  const ziele = await p.$$eval("a[href^='/']", (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
  console.log(`\n  ${seite} — ${ziele.length} interne Verweise`);
  for (const z of ziele) {
    const pfad = z.split("#")[0] || "/";
    const antwort = await p.request.get(`${B}${pfad}`, { maxRedirects: 0 });
    const s = antwort.status();
    const gut = s === 200 || (s >= 300 && s < 400);
    if (!gut) schlecht++;
    if (!gut) console.log(`  !!   ${s} ${z}`);
  }
  if (schlecht === 0) zeile(true, "alle Ziele antworten");
}

// ── Die Wege, die der Auftrag ausdrücklich nennt ─────────────
await p.goto(`${B}/`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1200);
const kopf = await p.locator("header").innerText();
zeile(/Für Unternehmen/.test(kopf), "„Für Unternehmen“ steht in der Kopfzeile");

const heroKnoepfe = await p.locator("main section").first().locator("a").allInnerTexts();
zeile(heroKnoepfe.some((t) => /Kostenlos mit/.test(t)), "Hauptknopf für Bewerber im Hero");
zeile(heroKnoepfe.some((t) => /Mitarbeiter/.test(t)), "Business-Knopf im Hero, ohne zu scrollen");

await p.getByRole("link", { name: /Ich suche Mitarbeiter/ }).first().click();
await p.waitForURL(/\/for-business/, { timeout: 30000 });
zeile(true, "„Ich suche Mitarbeiter“ führt zur Business-Seite");

await p.getByRole("link", { name: /Unternehmen registrieren/ }).first().click();
/*
 * Auf das ENDE der Kette warten.
 *
 * `/business/signup` ist eine Weiche und leitet weiter. Die erste
 * Fassung wartete auf `/(register|business)/` — das traf schon die
 * Weiche selbst, und der Test las eine Seite, die es gleich nicht mehr
 * gab.
 */
await p.waitForURL(/\/register\?/, { timeout: 30000 });
const nachReg = new URL(p.url());
zeile(
  nachReg.pathname === "/register" && nachReg.searchParams.get("absicht") === "unternehmen",
  `„Unternehmen registrieren“ landet mit Absicht bei der Anmeldung (${nachReg.pathname}${nachReg.search})`,
);
const wahl = await p.locator("fieldset").innerText();
zeile(/Ich suche einen Job/.test(wahl) && /Ich suche Mitarbeiter/.test(wahl), "Die Kontowahl steht über dem Formular");
zeile(
  (await p.locator('input[name="weiter"]').getAttribute("value")) === "/business/einrichten",
  "Die Absicht reist als verstecktes Feld mit",
);

// ── Fusszeile ────────────────────────────────────────────────
await p.goto(`${B}/`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1200);
const fuss = await p.locator("footer").innerText();
/*
 * Ohne Rücksicht auf Gross-/Kleinschreibung.
 *
 * Die Spaltenüberschriften tragen `uppercase` als CSS, und `innerText`
 * liefert den GERENDERTEN Text. Die erste Fassung suchte „Für
 * Unternehmen" und fand „FÜR UNTERNEHMEN" nicht.
 */
zeile(/für unternehmen/i.test(fuss), "Eigene Fusszeilen-Spalte für Unternehmen");
zeile(/Unternehmen registrieren/.test(fuss), "Registrierung steht auch im Fuss");

// ── Der Fünf-Sekunden-Test ───────────────────────────────────
const oben = (await p.locator("main").innerText()).slice(0, 900);
zeile(/Monday/.test(oben), "Monday wird oben genannt");
zeile(/versteht|lernt, was dir wichtig/.test(oben), "Dass sie zuerst den Menschen versteht");
zeile(/prüft echte Stellen/.test(oben), "Dass sie Stellen prüft");
zeile(/Mitarbeiter|Unternehmen/.test(oben), "Dass es eine Unternehmensseite gibt");

console.log(schlecht === 0 ? "\n  Kein toter Verweis." : `\n  ${schlecht} tote Verweise!`);
await b.close();
process.exit(schlecht === 0 ? 0 : 1);
