import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Für wie viele Stellen JE QUELLE lässt sich ein Gehalt schätzen?
 *
 * Der Einwand ist berechtigt: Auch die grossen Portale schätzen. Eine
 * Quelle ohne eigene Gehaltsangabe ist deshalb nicht wertlos — sie ist
 * es nur dann, wenn sich für ihre Stellen auch nichts schätzen lässt.
 *
 * Gemessen wird über die echte Kette: amtliche Berufsbezeichnung →
 * Entgelt-Referenz → sonst eigene Berufsgruppe.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { vergleichswert } = await import("../apps/web/src/lib/jobs/gehaltsvergleich.ts");
const { KEIN_VOLLZEITVERGLEICH } = await import("../apps/web/src/lib/jobs/beschaeftigungsform.ts");
const db = await getDb();

/*
 * Eine Stichprobe je Quelle, nicht der ganze Bestand.
 *
 * Der erste Versuch prüfte alle 30.000 Stellen nacheinander und lief
 * in die Zeitgrenze. Für einen Anteil genügen 400 je Quelle — der
 * Fehler liegt dann bei rund zwei Prozentpunkten, und darum geht es
 * hier nicht.
 */
const zeilen = (await db.execute(sql`
  select q, title, core_tasks, salary_min, salary_max from (
    select s.display_name q, j.title, j.core_tasks, j.salary_min, j.salary_max,
           row_number() over (partition by s.display_name order by random()) rn
    from jobs j join job_sources s on s.id = j.source_id
    where j.is_demo = false
  ) x where rn <= 400`)).rows;

const je = new Map();
for (const r of zeilen) {
  const q = String(r.q);
  const e = je.get(q) ?? { n: 0, eigen: 0, geschaetzt: 0, studentisch: 0, ohne: 0 };
  e.n++;
  if (r.salary_min !== null || r.salary_max !== null) { e.eigen++; je.set(q, e); continue; }
  const titel = String(r.title ?? "");
  if (KEIN_VOLLZEITVERGLEICH.test(titel)) { e.studentisch++; je.set(q, e); continue; }
  const v = await vergleichswert(titel, Array.isArray(r.core_tasks) ? r.core_tasks : []);
  if (v) e.geschaetzt++; else e.ohne++;
  je.set(q, e);
}

console.log("Quelle                    Probe   eigenes   geschätzt   zusammen   ohne");
console.log("─".repeat(78));
for (const [q, e] of [...je].sort((a, b) => b[1].n - a[1].n)) {
  const mit = e.eigen + e.geschaetzt;
  console.log(
    `${q.padEnd(26)} ${String(e.n).padStart(6)}  ${String(e.eigen).padStart(7)}  ${String(e.geschaetzt).padStart(9)}   ${String(`${(100*mit/e.n).toFixed(0)} %`).padStart(7)}  ${String(e.ohne).padStart(5)}`,
  );
}
process.exit(0);
