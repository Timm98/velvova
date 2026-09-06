import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/** Wo die Zeit auf dem Server hingeht — Phase für Phase. */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const [u] = (await db.execute(sql`
  insert into users (email) values (${`tempo-${Date.now()}@example.invalid`}) returning id`)).rows;

const uhr = async (name, f) => {
  const t0 = Date.now();
  const r = await f();
  console.log(`  ${name.padEnd(34)} ${String(Date.now()-t0).padStart(6)} ms`);
  return r;
};

const m = await import("../apps/web/src/lib/matching.ts");
const kand = await import("../apps/web/src/lib/kandidaten.ts");

console.log("Phase                                  Dauer");
const ctx = await uhr("Kontext laden", () => m.loadUserContext(u.id));

/* Die reine Abfrage. */
await uhr("Kandidaten zählen (SQL)", async () => {
  const b = kand.kandidatenBedingung(ctx.constraints ?? {}, null);
  return (await db.execute(sql`select count(*)::int n from jobs where ${b}`)).rows;
});

const geladen = await uhr("Kandidaten laden + bewerten", () => m.scoreJobsFor(u.id));
console.log(`     → ${Array.isArray(geladen) ? geladen.length : "?"} Stellen`);

await db.execute(sql`delete from users where id=${u.id}`);
process.exit(0);
