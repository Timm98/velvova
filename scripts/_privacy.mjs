import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`select kind, count(*)::int n from privacy_requests group by 1`)).rows;
console.log("privacy_requests:", r.length ? r.map(z => `${z.kind}=${z.n}`).join(", ") : "leer");
const [e] = (await db.execute(sql`select count(*)::int n from evidence_items where deleted_at is not null`)).rows;
console.log("gelöschte Belege:", e.n);
