import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select anbieter, count(*)::int gefragt, count(*) filter (where gefunden)::int gefunden,
         sum(stellen)::int stellen
  from arbeitgeber_boards group by 1 order by gefunden desc`)).rows;
for (const z of r) console.log(`${String(z.anbieter).padEnd(18)} gefragt ${String(z.gefragt).padStart(5)} · gefunden ${String(z.gefunden).padStart(4)} · Stellen ${z.stellen ?? 0}`);
console.log("\nStellen je Arbeitgeber-Quelle:");
for (const z of s2) console.log(`  ${String(z.quelle).padEnd(22)} ${Number(z.roh).toLocaleString("de-DE")}`);
