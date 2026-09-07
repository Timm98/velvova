import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die Bilanz — und Mondays Rückfrage zu den gelesenen Achsen.
 *
 * Beide Seiten haben eine Eigenschaft gemeinsam, die geprüft werden
 * muss: Sie müssen auch dann etwas Richtiges sagen, wenn sie nichts zu
 * sagen haben.
 */
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport:{width:1440,height:1200}, locale:"de-DE" }).then(c=>c.newPage());
p.setDefaultTimeout(60000);
let fehler = 0;
const zeile = (ok,m)=>{console.log(`  ${ok?"ok  ":"!!  "} ${m}`); if(!ok)fehler++;};

await p.goto(`${B}/register`, { waitUntil:"domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`bilanz-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort",{exact:false}).first().fill("ProbeProbe1234!");
await p.getByRole("button",{name:/Konto anlegen/i}).click();
await p.waitForURL(/\/(app|setup)/,{timeout:60000});

// ── Bilanz mit leerem Konto ──
await p.goto(`${B}/app/bilanz`, { waitUntil:"domcontentloaded" });
await p.getByRole("heading", { name: /Haben unsere Empfehlungen getaugt/i }).waitFor({ timeout: 45000 }).catch(()=>{});
let t = (await p.locator("main").innerText()).replace(/\s+/g," ");
zeile(/Haben unsere Empfehlungen getaugt/i.test(t), "Die Bilanz steht da");
zeile(/Noch nichts zu zeigen/i.test(t), "Ohne Daten sagt sie das ausdrücklich");
zeile(/unveränderlich/i.test(t), "Und erklärt, dass die Aufzeichnung trotzdem läuft");
zeile(/nicht, dass die Empfehlung es bewirkt/i.test(t),
  "Die Grenze der Aussage steht auch im leeren Zustand dabei");

// ── Mondays Rückfrage: erst nach einer Gesprächsantwort ──
await p.goto(`${B}/app/career`, { waitUntil:"domcontentloaded" });
await p.getByText(/Wie du arbeiten willst/i).first().waitFor({ timeout: 45000 }).catch(()=>{});
t = (await p.locator("main").innerText()).replace(/\s+/g," ");
zeile(!/Habe ich das richtig verstanden/i.test(t),
  "Ohne Gespräch fragt Monday nichts nach");
zeile(/Wie du arbeiten willst/i.test(t), "Die zehn Regler stehen da");
zeile(/noch nicht beantwortet/i.test(t), "Unangetastete Achsen sind als solche gekennzeichnet");
zeile(/wird nicht geraten/i.test(t), "Und es steht dabei, dass Ausgelassenes nicht geraten wird");

await b.close();
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : "\nAlle Prüfungen bestanden.");
process.exit(fehler ? 1 : 0);
