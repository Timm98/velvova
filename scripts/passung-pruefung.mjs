import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Zeigt die Stellenseite die vier Aussagen — oder wieder nur eine Zahl?
 *
 * Die Vision verlangt ausdrücklich, dass formale Anforderungen,
 * Fähigkeiten, Arbeitsalltag und Sicherheit getrennt dastehen. Der
 * Wert wurde berechnet und die Sicherheit gar nicht angezeigt; genau
 * das soll hier nicht zurückfallen.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [j] = (await db.execute(sql`
  select id, title from jobs where is_demo=false order by id limit 1`)).rows;

const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport:{width:1440,height:1200}, locale:"de-DE" }).then(c=>c.newPage());
p.setDefaultTimeout(60000);
let fehler = 0;
const zeile = (ok,m)=>{console.log(`  ${ok?"ok  ":"!!  "} ${m}`); if(!ok)fehler++;};

await p.goto(`${B}/register`, { waitUntil:"domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`passung-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort",{exact:false}).first().fill("ProbeProbe1234!");
await p.getByRole("button",{name:/Konto anlegen/i}).click();
await p.waitForURL(/\/(app|setup)/,{timeout:60000});

console.log(`  Stelle: „${String(j.title).slice(0,46)}"`);
await p.goto(`${B}/app/jobs/${j.id}`, { waitUntil:"domcontentloaded" });
await p.getByText(/Passung im Einzelnen/i).first().waitFor({timeout:45000}).catch(()=>{});
const t = (await p.locator("main").innerText()).replace(/\s+/g," ");

zeile(/Passung im Einzelnen/i.test(t), "Der Befund steht da");
for (const [name, muster] of [
  ["Formale Anforderungen", /Formale Anforderungen/i],
  ["Fähigkeiten zur Tätigkeit", /Fähigkeiten zur Tätigkeit/i],
  ["Arbeitsalltag zu dir", /Arbeitsalltag zu dir/i],
  ["Sicherheit der Einschätzung", /Wie sicher diese Einschätzung ist/i],
]) zeile(muster.test(t), `Die Aussage „${name}“ steht getrennt da`);

/*
 * Die Stufen dürfen nicht alle gleich sein.
 *
 * Vier Zeilen, die immer dasselbe Wort tragen, wären eine Zahl in
 * vier Zeilen — genau das, was ersetzt werden sollte.
 */
const stufen = await p.locator('section[aria-labelledby="passung"] span').allInnerTexts();
/* Die Sicherheitszeile hat ein eigenes Vokabular: „hoch/mittel/gering"
   liest sich dort richtiger als „passt/unbekannt". */
const worte = stufen.filter(s => /^(passt|teilweise|passt nicht|unbekannt|hoch|mittel|gering)$/i.test(s.trim()));
zeile(worte.length === 4, `Vier Stufenangaben (gefunden: ${worte.length})`);
zeile(/unbekannt|offen|nicht vollständig|sagt nichts/i.test(t),
  "Unbekanntes wird als unbekannt ausgewiesen, nicht als schlecht");
await b.close();
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : "\nAlle Prüfungen bestanden.");
process.exit(fehler ? 1 : 0);
