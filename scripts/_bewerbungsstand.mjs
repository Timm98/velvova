import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`select stage, count(*)::int n from applications group by 1`)).rows;
console.log("Bewerbungen je Stand:", r.map(z => `${z.stage}=${z.n}`).join(", ") || "keine");
