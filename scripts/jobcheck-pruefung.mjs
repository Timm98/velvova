import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Der Job-Check von der Zusage bis zur Empfehlung.
 *
 * Geprüft wird der Fall, um den es geht: In der Anzeige steht
 * Homeoffice ab Tag eins, im Gespräch heisst es „erst nach der
 * Probezeit". Beides klingt für sich plausibel — und der Widerspruch
 * muss auf der Seite stehen, bevor jemand unterschreibt.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const B = "http://localhost:3000";
let fehler = 0;
const zeile = (ok, m) => { console.log(`  ${ok ? "ok  " : "!!  "} ${m}`); if (!ok) fehler++; };

const b = await chromium.launch();
const p = await b.newContext({ viewport:{width:1440,height:1400}, locale:"de-DE" }).then(c=>c.newPage());
p.setDefaultTimeout(60000);
const mail = `check-${Date.now()}@example.invalid`;
await p.goto(`${B}/register`, { waitUntil:"domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(mail);
await p.getByLabel("Passwort",{exact:false}).first().fill("ProbeProbe1234!");
await p.getByRole("button",{name:/Konto anlegen/i}).click();
await p.waitForURL(/\/(app|setup)/,{timeout:60000});

/* Eine Bewerbung im Gesprächsstadium anlegen. */
const [u] = (await db.execute(sql`select id from users where email=${mail}`)).rows;
const [j] = (await db.execute(sql`select id from jobs where is_demo=false limit 1`)).rows;
const [a] = (await db.execute(sql`
  insert into applications (user_id, job_id, stage) values (${u.id}, ${j.id}, 'offer') returning id`)).rows;

await p.goto(`${B}/app/zusagen`, { waitUntil:"domcontentloaded" });
await p.getByText(/Soll ich diesen Job annehmen/i).waitFor({ timeout: 45000 }).catch(()=>{});
let t = (await p.locator("main").innerText()).replace(/\s+/g," ");
zeile(/Soll ich diesen Job annehmen/i.test(t), "Der Job-Check steht da");
zeile(/Erst klären/i.test(t), "Ohne Angaben rät er zum Klären, nicht zum Zusagen");
zeile(/Ungeklärt/i.test(t), "Der Kasten „Ungeklärt“ ist da");
zeile(/Das würde ich vorher fragen/i.test(t), "Und Fragen fürs Gespräch");
zeile(/weder das Team noch den Vorgesetzten/i.test(t), "Die Grenze der Aussage steht dabei");

/* Der Widerspruch: Anzeige gegen Gespräch. */
await db.execute(sql`
  insert into zusagen (user_id, application_id, punkt, zusage, herkunft, beleg)
  values (${u.id}, ${a.id}, 'homeoffice', 'Homeoffice ab Tag eins', 'anzeige', 'Anzeigentext'),
         (${u.id}, ${a.id}, 'homeoffice', 'Homeoffice erst nach der Probezeit', 'gespraech', 'zweites Gespräch')`);

await p.goto(`${B}/app/zusagen`, { waitUntil:"domcontentloaded" });
await p.getByText(/Widersprüchlich/i).waitFor({ timeout: 30000 }).catch(()=>{});
t = (await p.locator("main").innerText()).replace(/\s+/g," ");
zeile(/Widersprüchlich/i.test(t), "Der vierte Kasten erscheint");
zeile(/ab Tag eins/i.test(t) && /nach der Probezeit/i.test(t), "Beide Aussagen stehen darin");
zeile(/Kläre vor der Unterschrift/i.test(t), "Mit der Aufforderung, es vorher zu klären");
zeile(/Es hieß einmal|Es hiess einmal/i.test(t), "Die Frage fürs Gespräch nennt beide Fassungen");
zeile(/Erst klären/i.test(t), "Die Empfehlung bleibt „Erst klären“ — kein Ablehnen wegen eines Widerspruchs");

await b.close();
await db.execute(sql`delete from users where id=${u.id}`);
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : "\nAlle Prüfungen bestanden.");
process.exit(fehler ? 1 : 0);
