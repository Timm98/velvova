import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`select quelle, roh, eindeutig, aktiv, berechnet_am from bestandskennzahlen where quelle = ''`)).rows;
if (!r.length) console.log("noch keine Zeile — die Auszählung läuft");
for (const z of r) console.log(`roh ${Number(z.roh).toLocaleString("de-DE")} · eindeutig ${Number(z.eindeutig).toLocaleString("de-DE")} · aktiv ${Number(z.aktiv).toLocaleString("de-DE")} · ${new Date(z.berechnet_am).toLocaleTimeString("de-DE")}`);
