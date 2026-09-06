import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/** Welche Berufe im Bestand haben kein Foto — und wie viele Stellen hängen daran? */
const { berufsgruppe } = await import("../apps/web/src/lib/jobs/visuals.ts");
const { FOTOS } = await import("../apps/web/src/lib/fotos.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const proGruppe = new Map();
for (const f of FOTOS) if (f.art === "beruf" && f.gruppe)
  proGruppe.set(f.gruppe, (proGruppe.get(f.gruppe) ?? 0) + 1);

const stellen = (await db.execute(sql`
  select title, count(*)::int as n from jobs where is_demo = false
  group by title order by n desc limit 6000`)).rows;

const je = new Map(); let ohne = 0, gesamt = 0;
const ohneBeispiele = new Map();
for (const s of stellen) {
  const n = Number(s.n); gesamt += n;
  const g = berufsgruppe(String(s.title), []);
  if (!g) { ohne += n; ohneBeispiele.set(String(s.title), n); continue; }
  je.set(g, (je.get(g) ?? 0) + n);
}

console.log(`Stichprobe: ${gesamt.toLocaleString("de-DE")} Stellen aus den 6.000 häufigsten Titeln`);
console.log(`ohne Berufsfeld und damit ohne Foto: ${ohne.toLocaleString("de-DE")} (${(100*ohne/gesamt).toFixed(1)} %)\n`);
console.log("Feld".padEnd(20), "Stellen".padStart(9), "Motive".padStart(8), "  Stellen je Motiv");
for (const [g, n] of [...je].sort((a,b) => b[1]-a[1])) {
  const m = proGruppe.get(g) ?? 0;
  const warnung = m === 0 ? "  ← KEIN MOTIV" : m < 4 ? "  ← zu wenige" : "";
  console.log(`${g.padEnd(20)} ${String(n).padStart(9)} ${String(m).padStart(8)}   ${m ? Math.round(n/m).toLocaleString("de-DE") : "—"}${warnung}`);
}
console.log("\nHäufigste Titel ganz ohne Feld:");
for (const [t, n] of [...ohneBeispiele].sort((a,b)=>b[1]-a[1]).slice(0, 20))
  console.log(`  ${String(n).padStart(5)}  ${t.slice(0, 64)}`);
process.exit(0);
