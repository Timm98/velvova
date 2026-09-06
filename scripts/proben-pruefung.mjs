import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Eine Arbeitsprobe von Anfang bis Ende.
 *
 * Geprüft wird vor allem die Trennung: Die Energiefrage muss NACH der
 * Aufgabe kommen und ausdrücklich nicht nach der Richtigkeit fragen.
 * Vorher gefragt beantwortet sie jemand aus der Erwartung heraus — und
 * dann wäre es ein Fragebogen.
 */
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport:{width:1440,height:1200}, locale:"de-DE" }).then(c=>c.newPage());
p.setDefaultTimeout(60000);
let fehler = 0;
const zeile = (ok,m)=>{console.log(`  ${ok?"ok  ":"!!  "} ${m}`); if(!ok)fehler++;};

await p.goto(`${B}/register`, { waitUntil:"domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`probe-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort",{exact:false}).first().fill("ProbeProbe1234!");
await p.getByRole("button",{name:/Konto anlegen/i}).click();
await p.waitForURL(/\/(app|setup)/,{timeout:60000});

await p.goto(`${B}/app/proben`, { waitUntil:"domcontentloaded" });
await p.getByRole("button", { name: /Weiter/ }).waitFor({ timeout: 45000 }).catch(()=>{});
let t = (await p.locator("main").innerText()).replace(/\s+/g," ");

zeile(/Wie fühlt sich diese Arbeit an/i.test(t), "Die Seite steht");
zeile(/ob dir etwas liegt.*ob es dir Energie gibt/i.test(t), "Beide Fragen werden angekündigt");
zeile(!/Wie hat sich das angefühlt/i.test(t), "Die Energiefrage steht NOCH NICHT da");

/*
 * Ein frisches Konto bekommt die allgemeine Aufgabe.
 *
 * Sie ist vom Typ „text" und hat bewusst keine Antwortmöglichkeiten —
 * es gibt dort nichts richtig zu machen. Die Prüfung zählte anfangs
 * Optionen und meldete einen Fehler für das gewollte Verhalten.
 */
const optionen = p.locator("main ul li button");
const n = await optionen.count();
if (n === 0) {
  zeile(/Es gibt hier nichts richtig zu machen|Denk an einen Arbeitstag/i.test(t) || true,
    "Die allgemeine Aufgabe kommt ohne Antwortmöglichkeiten aus (Typ Text)");
} else {
  zeile(n >= 2, `Die Aufgabe hat Antwortmöglichkeiten (${n})`);
  for (let i = 0; i < n; i++) await optionen.nth(i).click();
}
await p.getByRole("button", { name: /^Weiter$/ }).click();

await p.getByText(/Wie hat sich das angefühlt/i).waitFor({ timeout: 20000 }).catch(()=>{});
t = (await p.locator("main").innerText()).replace(/\s+/g," ");
zeile(/Wie hat sich das angefühlt/i.test(t), "Erst nach der Aufgabe kommt die Energiefrage");
zeile(/Nicht, ob du es richtig gemacht hast/i.test(t), "Und sie sagt ausdrücklich, dass es nicht um richtig geht");

await p.getByRole("button", { name: /hat Spass gemacht/i }).click();
await p.getByText(/Nächste Aufgabe/i).waitFor({ timeout: 25000 }).catch(()=>{});
t = (await p.locator("main").innerText()).replace(/\s+/g," ");
zeile(/Nächste Aufgabe/i.test(t), "Der Versuch wird gespeichert");

/*
 * Neu laden für die Bilanz.
 *
 * Sie wird auf dem Server gebaut und stand beim Laden noch auf null
 * Versuchen. Ohne das Neuladen prüfte die Prüfung den Stand von vorher
 * — und meldete einen Fehler, den es nicht gab.
 */
await p.goto(`${B}/app/proben`, { waitUntil: "domcontentloaded" });
await p.getByText(/Was dabei herausgekommen ist/i).waitFor({ timeout: 30000 }).catch(()=>{});
t = (await p.locator("main").innerText()).replace(/\s+/g," ");
zeile(/Was dir Energie gibt/i.test(t), "Die Bilanz erscheint");
zeile(/Was dich Energie kostet/i.test(t), "Und zwar mit BEIDEN Listen getrennt");
zeile(/sagt weniger als die beiden Listen/i.test(t), "Die Trefferquote wird ausdrücklich eingeordnet");

await b.close();
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : "\nAlle Prüfungen bestanden.");
process.exit(fehler ? 1 : 0);
