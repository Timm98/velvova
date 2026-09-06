import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { KEIN_VOLLZEITVERGLEICH } = await import("../apps/web/src/lib/jobs/beschaeftigungsform.ts");
const db = await getDb();
const r = (await db.execute(sql`select titel from beruf_zuordnung`)).rows;
let n = 0;
for (const x of r) {
  if (KEIN_VOLLZEITVERGLEICH.test(String(x.titel))) {
    await db.execute(sql`delete from beruf_zuordnung where titel = ${x.titel}`);
    n++;
  }
}
console.log("Werkstudenten-/Praktikumszeilen entfernt:", n);
process.exit(0);
