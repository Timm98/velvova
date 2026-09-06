import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [a] = (await db.execute(sql`
  select count(*)::int n,
    count(*) filter (where description like '%**%')::int fett,
    count(*) filter (where description ~ '^#{1,4} ' or description ~ E'\\n#{1,4} ')::int ueberschrift,
    count(*) filter (where description like '%<%>%')::int html,
    count(*) filter (where description ~ E'\\n\\\\* ' or description ~ E'\\n- ')::int liste
  from jobs tablesample system (3) where description is not null`)).rows;
const p = (x) => `${((x / a.n) * 100).toFixed(1)} %`;
console.log(`Stichprobe ${a.n.toLocaleString("de-DE")}`);
console.log(`  ** fett          ${String(a.fett).padStart(6)}  ${p(a.fett)}`);
console.log(`  # Überschrift    ${String(a.ueberschrift).padStart(6)}  ${p(a.ueberschrift)}`);
console.log(`  HTML-Tags        ${String(a.html).padStart(6)}  ${p(a.html)}`);
console.log(`  Listenzeichen    ${String(a.liste).padStart(6)}  ${p(a.liste)}`);
