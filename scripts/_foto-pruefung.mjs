import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [j] = (await db.execute(sql`
  select id, title from jobs where is_demo=false and title ~* 'tischler|elektr|pflege' order by id limit 1`)).rows;
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport:{width:1440,height:1100}, locale:"de-DE" }).then(c=>c.newPage());
p.setDefaultTimeout(60000);
let fehler = 0;
const zeile = (ok,m)=>{console.log(`  ${ok?"ok  ":"!!  "} ${m}`); if(!ok)fehler++;};
await p.goto(`${B}/register`, { waitUntil:"domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`foto-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort",{exact:false}).first().fill("ProbeProbe1234!");
await p.getByRole("button",{name:/Konto anlegen/i}).click();
await p.waitForURL(/\/(app|setup)/,{timeout:60000});

console.log(`  Stelle: „${String(j.title).slice(0,48)}"`);
await p.goto(`${B}/app/jobs/${j.id}`, { waitUntil:"domcontentloaded" });
await p.locator('img[src*="/fotos/beruf/"]').first().waitFor({timeout:45000}).catch(()=>{});
const held = p.locator('img[src*="/fotos/beruf/"]').first();
zeile(await held.count() > 0, "Der Kopf zeigt ein Foto");
if (await held.count()) {
  const q = await held.getAttribute("src");
  const a = await held.getAttribute("alt");
  zeile(Boolean(a && a.length > 10), `Mit Beschreibung: „${String(a).slice(0,44)}"`);
  const antwort = await p.request.get(`${B}${q}`);
  zeile(antwort.ok(), `Die Datei wird ausgeliefert (HTTP ${antwort.status()}, ${Math.round(Number(antwort.headers()["content-length"]??0)/1024)} kB)`);
}
const t = await p.locator("main").innerText();
zeile(/Symbolbild/i.test(t), "Das Etikett sagt „Symbolbild“, nicht „Illustration“");

await p.goto(`${B}/app/jobs`, { waitUntil:"domcontentloaded" });
await p.locator('img[src*="/fotos/beruf/"]').first().waitFor({timeout:45000}).catch(()=>{});
const inListe = await p.locator('img[src*="/fotos/beruf/"]').count();
zeile(inListe >= 5, `In der Liste stehen Fotos (${inListe} Zeilen)`);
const klein = await p.locator('img[src*="-klein.webp"]').count();
zeile(klein >= 5, `Und zwar die kleine Fassung (${klein})`);
await b.close();
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : "\nAlle Prüfungen bestanden.");
process.exit(fehler ? 1 : 0);
