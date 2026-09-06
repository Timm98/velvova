import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/** Wie lange die Seiten wirklich brauchen — mit einem echten Konto. */
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport:{width:1440,height:1100}, locale:"de-DE" }).then(c=>c.newPage());
p.setDefaultTimeout(120000);
p.setDefaultNavigationTimeout(120000);

await p.goto(`${B}/register`, { waitUntil:"domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`tempo-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort",{exact:false}).first().fill("ProbeProbe1234!");
await p.getByRole("button",{name:/Konto anlegen/i}).click();
await p.waitForURL(/\/(app|setup)/,{timeout:60000});

const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [j] = (await db.execute(sql`select id from jobs where is_demo=false order by id limit 1`)).rows;

const messen = async (name, url, warten) => {
  const zeiten = [];
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    await p.goto(url, { waitUntil: "domcontentloaded" });
    if (warten) await p.locator(warten).first().waitFor({ timeout: 110000 }).catch(() => {});
    zeiten.push(Date.now() - t0);
  }
  const m = Math.round(zeiten.reduce((a,b)=>a+b,0)/zeiten.length);
  console.log(`  ${name.padEnd(22)} ${String(m).padStart(6)} ms   (${zeiten.join(", ")})`);
  return m;
};

console.log("Seite                     Mittel   Einzelmessungen");
await messen("Stellenliste", `${B}/app/jobs`, "main");
await messen("Stellenliste (2. Seite)", `${B}/app/jobs?page=2`, "main");
await messen("Stellendetail", `${B}/app/jobs/${j.id}`, "h1");
await messen("Heute", `${B}/app`, "main");
await b.close();
process.exit(0);
