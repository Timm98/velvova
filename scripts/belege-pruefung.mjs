import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Prüft die Belegkette gegen die echte Datenbank.
 *
 * Nicht gegen Testdaten: Die Frage ist, ob im Bestand tatsächlich
 * beobachtete Belege entstehen — und ob die Freigabe wirklich
 * standardmässig aus ist.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql: roh } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { belegstufe, belegbilanz } = await import("../packages/domain/src/belegkraft.ts");
const { berichteteAussagen } = await import("../packages/domain/src/berichtet.ts");
const db = await getDb();
const sql = async (strings, ...werte) => {
  const text = strings.raw.join("");
  return (await db.execute(roh.raw(text))).rows ?? [];
};

const herkunft = await sql`
  select source_type, count(*)::int n, sum(case when geteilt then 1 else 0 end)::int geteilt
  from evidence_items where deleted_at is null group by 1 order by n desc`;

console.log("Belege im Bestand");
console.log("─".repeat(62));
const stufen = [];
for (const z of herkunft) {
  const s = belegstufe(z.source_type, false, null);
  console.log(`${z.source_type.padEnd(18)} ${String(z.n).padStart(6)}   ${s.padEnd(12)} geteilt: ${z.geteilt}`);
  for (let i = 0; i < z.n; i++) stufen.push(s);
}
const b = belegbilanz(stufen);
console.log(`\nzusammen ${b.gesamt} — belegt ${(b.belegt * 100).toFixed(0)} %`);

const proben = await sql`select count(*)::int n from probendurchlaeufe`;
const ausProben = await sql`
  select count(*)::int n from evidence_items where source_type = 'work_sample'`;
console.log(`\nProbendurchläufe ${proben[0].n} → Belege daraus ${ausProben[0].n}`);

const verlauf = await sql`
  select user_id, dimension, wert, herkunft, erfasst_am from arbeitsprofil
  order by user_id, dimension`;
const jeNutzer = new Map();
for (const z of verlauf) {
  const l = jeNutzer.get(z.user_id) ?? [];
  l.push({ dimension: z.dimension, wert: z.wert, herkunft: z.herkunft, erfasstAm: new Date(z.erfasst_am) });
  jeNutzer.set(z.user_id, l);
}
let reif = 0;
let spannen = [];
for (const [, l] of jeNutzer) {
  const a = berichteteAussagen(l);
  reif += a.length;
  const nach = new Map();
  for (const n of l) nach.set(n.dimension, [...(nach.get(n.dimension) ?? []), n.erfasstAm.getTime()]);
  for (const [, t] of nach) spannen.push(Math.round((Math.max(...t) - Math.min(...t)) / 86400000));
}
spannen.sort((x, y) => y - x);
console.log(`\nArbeitsprofil: ${verlauf.length} Nennungen bei ${jeNutzer.size} Nutzern`);
console.log(`längste Spanne je Dimension: ${spannen.slice(0, 3).join(", ") || "—"} Tage`);
console.log(`über 60 Tage berichtet: ${reif}`);


