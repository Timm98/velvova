/**
 * Wie viele Konten haben überhaupt ein ausgefülltes Profil?
 *
 * Die Frage entscheidet, was sich an Karriere, Today und Rollen
 * überhaupt prüfen lässt. Ein frisch angelegtes Konto zeigt überall
 * Leerzustände — richtig, aber nichtssagend. Erst ein bestätigtes
 * Profil zeigt, ob die Bereiche tragen.
 *
 *   node scripts/profil-bestand.mjs
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

const { getDb, schema } = await import("../packages/db/src/index.ts");
const { sql, eq } = await import("../packages/db/node_modules/drizzle-orm/index.js");

const db = await getDb();
const eins = async (q) => (await q)[0]?.n ?? 0;

const konten = await eins(db.select({ n: sql`count(*)::int` }).from(schema.users));
const profile = await eins(db.select({ n: sql`count(*)::int` }).from(schema.careerProfiles));
const bestaetigt = await eins(
  db.select({ n: sql`count(*)::int` }).from(schema.careerProfiles).where(eq(schema.careerProfiles.confirmedByUser, true)),
);
const belege = await eins(db.select({ n: sql`count(*)::int` }).from(schema.evidenceItems));
const cluster = await eins(db.select({ n: sql`count(*)::int` }).from(schema.roleClusters));
const bewerbungen = await eins(db.select({ n: sql`count(*)::int` }).from(schema.applications));
const coaching = await eins(db.select({ n: sql`count(*)::int` }).from(schema.coachingSessions));

console.log(`  Konten:            ${konten}`);
console.log(`  Karriereprofile:   ${profile}  (davon bestätigt: ${bestaetigt})`);
console.log(`  Belege:            ${belege}`);
console.log(`  Rollencluster:     ${cluster}`);
console.log(`  Bewerbungen:       ${bewerbungen}`);
console.log(`  Coaching-Sitzungen:${coaching}`);

const mitBelegen = await db
  .select({ userId: schema.evidenceItems.userId, n: sql`count(*)::int` })
  .from(schema.evidenceItems)
  .groupBy(schema.evidenceItems.userId)
  .orderBy(sql`count(*) desc`)
  .limit(3);
if (mitBelegen.length > 0) {
  console.log("\n  Konten mit den meisten Belegen:");
  for (const r of mitBelegen) console.log(`    ${r.userId.slice(0, 8)}… → ${r.n} Belege`);
}
process.exit(0);
