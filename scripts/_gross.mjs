import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select count(*)::int n, coalesce(sum(anzeigen),0)::bigint summe,
         coalesce(sum(least(anzeigen,10000)),0)::bigint erreichbar
  from beruf_wortschatz where anzeigen >= 8000`)).rows[0];
console.log(`Berufe über 8.000 Anzeigen: ${r.n}`);
console.log(`  tatsächlich vorhanden:    ${Number(r.summe).toLocaleString("de-DE")}`);
console.log(`  ohne Ortsachse erreichbar: ${Number(r.erreichbar).toLocaleString("de-DE")}`);
console.log(`  → unerreichbar: ${(Number(r.summe) - Number(r.erreichbar)).toLocaleString("de-DE")}`);
process.exit(0);
