import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { titelNormalisieren } = await import("../apps/web/src/lib/jobs/berufsreferenz.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`select title from jobs`)).rows;
const s = new Set();
for (const x of r) { const n = titelNormalisieren(String(x.title ?? "")); if (n.length >= 3) s.add(n); }
console.log(`${r.length} Stellen → ${s.size} normalisierte Titel`);
console.log([...s].slice(0, 6).join(" | "));
process.exit(0);
