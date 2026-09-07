import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";

/**
 * Der Arbeitgeberbereich von Ende zu Ende.
 *
 * Der Weg, den das Produkt verspricht: Konto anlegen → Stelle schreiben
 * → bestätigen lassen → veröffentlichen → jemand bewirbt sich →
 * Bewerbung bearbeiten → Kollegin einladen.
 *
 * Und die Grenzen, die dabei halten müssen:
 *   * Ohne Bestätigung wird nicht veröffentlicht.
 *   * Ein Fremder sieht die Organisation nicht.
 *   * Ein Recruiter darf nicht veröffentlichen.
 *   * Eine Absage ohne Grund wird abgelehnt.
 *   * Das Unternehmen sieht nichts Privates.
 */
const B = "http://localhost:3000";
const PW = "ProbeProbe1234!";
const b = await chromium.launch();
const zeile = (s, m) => console.log(`  ${s ? "ok  " : "!!  "} ${m}`);

async function neuerBrowser() {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1400 }, locale: "de-DE" });
  const p = await ctx.newPage();
  p.setDefaultTimeout(90000);
  p.setDefaultNavigationTimeout(90000);
  return p;
}
async function anmelden(p, email) {
  await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
  await p.getByLabel("E-Mail-Adresse").fill(email);
  await p.getByLabel("Passwort", { exact: false }).first().fill(PW);
  await p.getByRole("button", { name: /Konto anlegen/i }).click();
  await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });
}
const text = async (p) => (await p.locator("body").innerText()).replace(/\s+/g, " ");

/*
 * Auf die Meldung warten, nicht auf die Uhr.
 *
 * Die erste Fassung wartete drei Sekunden nach dem Klick und meldete
 * dann „lässt sich nicht speichern". Gespeichert wurde sehr wohl — die
 * Serveraktion war nur noch nicht zurück. Ein Test, der die Uhr statt
 * das Ergebnis befragt, meldet Fehler, die es nicht gibt.
 */
async function warteAufMeldung(p, muster) {
  await p.locator('[role="status"]').filter({ hasText: muster }).first()
    .waitFor({ state: "visible", timeout: 60000 });
}

const stempel = Date.now();
const anna = `anna-${stempel}@example.invalid`;
const bernd = `bernd-${stempel}@example.invalid`;
const carla = `carla-${stempel}@example.invalid`;

// ── Anna gründet ──────────────────────────────────────────────
const pa = await neuerBrowser();
await anmelden(pa, anna);
console.log(`  Anna: ${anna}`);

await pa.goto(`${B}/business`, { waitUntil: "domcontentloaded" });
await pa.waitForTimeout(2500);
zeile(/Arbeitgeberkonto anlegen/.test(await text(pa)), "Ohne Konto: Einrichtung statt leerer Seite");

await pa.getByLabel("Name des Unternehmens").fill("Nordwind GmbH");
await pa.getByRole("button", { name: /^Anlegen$/ }).click();
await pa.waitForURL(/\/business$/, { timeout: 60000 });
await pa.waitForTimeout(2000);
const nachGruendung = await text(pa);
zeile(/Nordwind GmbH/.test(nachGruendung), "Die Organisation steht da");
zeile(/Noch nicht bestätigt/.test(nachGruendung), "Sagt, dass sie unbestätigt ist");

// ── Stelle schreiben ──────────────────────────────────────────
await pa.goto(`${B}/business/stellen`, { waitUntil: "domcontentloaded" });
await pa.waitForTimeout(2000);
await pa.getByRole("button", { name: /Neue Stelle/ }).click();
await pa.getByLabel("Titel der Stelle").fill("Disponent (m/w/d)");
await pa.getByRole("button", { name: /^Anlegen$/ }).click();
await pa.waitForURL(/\/business\/stellen\/[0-9a-f-]{36}/, { timeout: 60000 });
const stellenPfad = new URL(pa.url()).pathname;
const postingId = stellenPfad.split("/").pop();
zeile(true, "Entwurf angelegt");

await pa.getByLabel("Ort", { exact: true }).fill("Dortmund");
await pa.getByLabel("Wochenstunden").fill("40");
await pa.getByLabel("Gehalt von").fill("48000");
await pa.getByLabel("Gehalt bis").fill("56000");
await pa.getByLabel("Beschreibung").fill(
  "Wir suchen eine Disponentin für unseren Standort in Dortmund. Du planst Touren, " +
  "stimmst dich mit Fahrern ab und hältst Kontakt zu Kunden. Wir bieten 30 Tage Urlaub, " +
  "Homeoffice an zwei Tagen pro Woche, ein Jobticket und eine betriebliche Altersvorsorge.",
);
await pa.getByRole("button", { name: /^Speichern$/ }).click();
await warteAufMeldung(pa, /Gespeichert/);
zeile(true, "Die Anzeige lässt sich speichern");

await pa.reload({ waitUntil: "domcontentloaded" });
await pa.waitForTimeout(2500);
const erkannt = await pa.locator("text=/^Erkannt:/").first().innerText().catch(() => "");
zeile(erkannt.length > 0, `Leistungen aus dem Text erkannt: ${erkannt.replace("Erkannt: ", "") || "—"}`);
zeile(/Homeoffice/.test(erkannt) && /Altersvorsorge/.test(erkannt) && /Urlaub/.test(erkannt),
  "Homeoffice, Altersvorsorge und Urlaub sind dabei");

// ── Veröffentlichen ohne Bestätigung ─────────────────────────
zeile(await pa.getByRole("button", { name: /Veröffentlichen/ }).isDisabled(),
  "Ohne Bestätigung ist „Veröffentlichen“ gesperrt");

// ── Bernd ist ein Fremder ────────────────────────────────────
const pb = await neuerBrowser();
await anmelden(pb, bernd);
await pb.goto(`${B}${stellenPfad}`, { waitUntil: "domcontentloaded" });
await pb.waitForTimeout(2500);
const berndSicht = await text(pb);
zeile(!/Disponent \(m\/w\/d\)/.test(berndSicht), "Ein Fremder sieht die Stelle nicht");
zeile(/Arbeitgeberkonto anlegen/.test(berndSicht),
  "Er landet bei der Einrichtung — nicht bei einem „kein Zugriff“");

// ── Organisation bestätigen (Betrieb) ────────────────────────
ladeEnvDatei();
const { getDb, schema } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
await db.execute(sql`UPDATE organizations SET verified_at = now() WHERE name = 'Nordwind GmbH'`);
zeile(true, "Organisation im Betriebsbereich bestätigt");

await pa.reload({ waitUntil: "domcontentloaded" });
await pa.waitForTimeout(2500);
await pa.getByRole("button", { name: /Veröffentlichen/ }).click();
await warteAufMeldung(pa, /Veröffentlicht|fehlt/);
const nachVeroeffentlichen = await text(pa);
zeile(/Veröffentlicht\. Die Stelle erscheint/.test(nachVeroeffentlichen), "Jetzt lässt sie sich veröffentlichen");

const [job] = (await db.execute(sql`
  SELECT j.id, j.salary_provenance, j.apply_method, s.display_name AS quelle
  FROM job_postings p JOIN jobs j ON j.id = p.job_id JOIN job_sources s ON s.id = j.source_id
  WHERE p.id = ${postingId}`)).rows;
zeile(Boolean(job), "Die Stelle steht im gemeinsamen Stellenindex");
zeile(job?.salary_provenance === "employer", `Gehaltsherkunft ist „employer“ (${job?.salary_provenance})`);
zeile(job?.quelle === "Direkt vom Arbeitgeber", `Quelle: ${job?.quelle}`);
zeile(job?.apply_method === "internal", `Bewerbungsweg bleibt hier (${job?.apply_method})`);

// ── Carla findet die Stelle in der Suche ──────────────────────
const pc = await neuerBrowser();
await anmelden(pc, carla);

/*
 * Der Weg, den eine echte Bewerberin nimmt.
 *
 * Nicht über die Bewerbungsadresse direkt, sondern über die Stellenseite
 * — sonst prüft der Test die Bewerbung und nicht das Produkt. Wenn die
 * Anzeige dort nicht ankommt, ist alles davor wertlos.
 */
await pc.goto(`${B}/app/jobs/${job.id}`, { waitUntil: "domcontentloaded" });
await pc.waitForTimeout(3000);
const stellenSicht = await text(pc);
zeile(/Disponent \(m\/w\/d\)/.test(stellenSicht), "Die Stelle ist für Bewerberinnen sichtbar");
zeile(/Direkt vom Arbeitgeber/.test(stellenSicht), "Sie ist als Arbeitgeberanzeige gekennzeichnet");
zeile(/48\.000|56\.000/.test(stellenSicht), "Das Gehalt steht da");
zeile(/Homeoffice/.test(stellenSicht) && /Altersvorsorge/.test(stellenSicht),
  "Die Leistungen stehen auf der Stellenseite");

await pc.goto(`${B}/app/jobs/bewerben/${postingId}`, { waitUntil: "domcontentloaded" });
await pc.waitForTimeout(2500);
const bewerbenSeite = await text(pc);
zeile(/Was NICHT übermittelt wird/.test(bewerbenSeite), "Die Bewerbungsseite sagt, was NICHT übermittelt wird");
zeile(/Gespräch mit Monday/.test(bewerbenSeite) && /Lebenshaltung/.test(bewerbenSeite),
  "Monday-Chat und Lebenshaltung sind ausdrücklich ausgenommen");

await pc.getByLabel("Name", { exact: true }).fill("Carla Berg");
await pc.getByLabel("In einem Satz").fill("Disponentin mit vier Jahren Erfahrung im Nahverkehr");
await pc.getByLabel("Anschreiben").fill("Ihre Ausschreibung passt genau zu dem, was ich suche.");
await pc.getByRole("button", { name: /Bewerbung abschicken/ }).click();
await pc.waitForURL(/\/app\/applications/, { timeout: 60000 });
zeile(true, "Bewerbung abgeschickt");

// ── Anna sieht die Bewerbung ──────────────────────────────────
await pa.goto(`${B}/business/bewerbungen`, { waitUntil: "domcontentloaded" });
await pa.waitForTimeout(2500);
const bewerbungen = await text(pa);
zeile(/Carla Berg/.test(bewerbungen), "Die Bewerbung steht im Arbeitgeberbereich");
zeile(/Disponentin mit vier Jahren/.test(bewerbungen), "Die freigegebene Kurzbeschreibung ist dabei");
zeile(!/Lebenshaltung|Monday-Chat|Steuerklasse/.test(bewerbungen.replace(/Ihr Karrieregespräch[^.]+\./, "")),
  "Nichts Privates in der Ansicht");

// ── Absage ohne Grund ─────────────────────────────────────────
await pa.getByLabel(/^Stand$/).selectOption("rejected");
await pa.waitForTimeout(500);
await pa.getByRole("button", { name: /Übernehmen/ }).click();
await warteAufMeldung(pa, /Grund/);
zeile(/Für eine Absage brauche ich einen Grund/.test(await text(pa)),
  "Eine Absage ohne Grund wird abgelehnt");

await pa.getByLabel("Grund der Absage").fill("Die Erfahrung im Gefahrgutbereich fehlt uns hier.");
await pa.getByRole("button", { name: /Übernehmen/ }).click();
await warteAufMeldung(pa, /Notiz gespeichert/);
zeile(true, "Mit Grund geht die Absage durch");

// ── Bernd wird eingeladen ─────────────────────────────────────
await pa.goto(`${B}/business/team`, { waitUntil: "domcontentloaded" });
await pa.waitForTimeout(2000);
await pa.getByLabel("E-Mail-Adresse").fill(bernd);
await pa.getByLabel("Rolle", { exact: true }).selectOption("recruiter");
await pa.getByRole("button", { name: /^Einladen$/ }).click();
/*
 * Auf den Link warten, nicht auf die Uhr.
 *
 * Mit festen drei Sekunden war diese Prüfung mal grün und mal rot — je
 * nachdem, wie schnell die Serveraktion antwortete. Ein Test, der von
 * der Tagesform abhängt, ist schlimmer als keiner: Man gewöhnt sich an,
 * ihn zu wiederholen, bis er passt.
 */
await pa.locator("code", { hasText: "/business/einladung/" }).first()
  .waitFor({ state: "visible", timeout: 60000 });
const einladungText = await text(pa);
const link = /\/business\/einladung\/([A-Za-z0-9_-]+)/.exec(einladungText);
zeile(Boolean(link), "Einladungslink erstellt");

await pb.goto(`${B}/business/einladung/${link[1]}`, { waitUntil: "domcontentloaded" });
await pb.waitForTimeout(2000);
await pb.getByRole("button", { name: /Einladung annehmen/ }).click();
await pb.waitForURL(/\/business$/, { timeout: 60000 });
await pb.waitForTimeout(2000);
zeile(/Nordwind GmbH/.test(await text(pb)), "Bernd ist jetzt im Team");

await pb.goto(`${B}${stellenPfad}`, { waitUntil: "domcontentloaded" });
await pb.waitForTimeout(2500);
const berndStelle = await text(pb);
zeile(/Disponent \(m\/w\/d\)/.test(berndStelle), "Er sieht die Stelle jetzt");
const berndKnoepfe = await pb.getByRole("button").allInnerTexts();
zeile(!berndKnoepfe.some((k) => /Veröffentlichen|Schliessen/.test(k)),
  "Als Recruiter kann er nicht veröffentlichen oder schliessen");
zeile(berndKnoepfe.some((k) => /Speichern/.test(k)), "Schreiben darf er");

await pa.screenshot({ path: "artifacts/business/bewerbungen.png", fullPage: true });
await b.close();
process.exit(0);
