import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die Beiträge — und ihre Belege.
 *
 * Der Kern dieser Seite ist nicht der Text, sondern die Zeile
 * darunter: worüber gezählt wurde. Ein Beitrag ohne nachvollziehbare
 * Grundlage wäre eine Behauptung, und davon gibt es genug.
 */
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport:{width:1440,height:1400}, locale:"de-DE" }).then(c=>c.newPage());
p.setDefaultTimeout(60000);
let fehler = 0;
const zeile = (ok,m)=>{console.log(`  ${ok?"ok  ":"!!  "} ${m}`); if(!ok)fehler++;};

await p.goto(`${B}/register`, { waitUntil:"domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`beitrag-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort",{exact:false}).first().fill("ProbeProbe1234!");
await p.getByRole("button",{name:/Konto anlegen/i}).click();
await p.waitForURL(/\/(app|setup)/,{timeout:60000});

await p.goto(`${B}/app/beitraege`, { waitUntil:"domcontentloaded" });
await p.getByRole("heading", { name: /Was gerade passiert/i }).waitFor({ timeout: 45000 }).catch(()=>{});
const t = (await p.locator("main").innerText()).replace(/\s+/g," ");

zeile(/Was gerade passiert/i.test(t), "Die Seite steht");
zeile(/Keine Nachrichten von aussen/i.test(t), "Sie sagt, woher die Aussagen stammen");

const beitraege = await p.locator("main article").count();
zeile(beitraege >= 4, `Mehrere Beiträge (${beitraege})`);

/*
 * Jeder Beitrag trägt einen Beleg.
 *
 * Das ist die Eigenschaft, die diese Seite von einem Blog trennt.
 */
zeile(/eigenen Bestand|Gezählt über|von .* Anzeigen/i.test(t), "Die Belege stehen dabei");
zeile(/\d/.test(t), "Und sie enthalten Zahlen, keine Behauptungen");

const bilder = await p.locator('main img[src*="/fotos/"]').count();
zeile(bilder >= 3, `Die Krisenbilder haben jetzt ein Ziel (${bilder} Bilder)`);

const alt = await p.locator('main img[src*="/fotos/"]').first().getAttribute("alt");
zeile(Boolean(alt && alt.length > 10), `Mit Beschreibung: „${String(alt).slice(0, 40)}"`);

await b.close();
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : "\nAlle Prüfungen bestanden.");
process.exit(fehler ? 1 : 0);
