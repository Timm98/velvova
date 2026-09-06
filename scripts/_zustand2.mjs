import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const tabellen = ["applications","offers","check_ins","reminders","notifications","zusagen",
  "zusagen_pruefungen","realitaetsproben","realitaetsrueckmeldungen","rollen_aussagen",
  "rollen_bestaetigungen","rollen_aufgaben","rollen_abgaenge","aufgabenproben","probendurchlaeufe",
  "empfehlungs_ergebnisse","fit_check_180","arbeitsprofil","stellen_profil","beitraege",
  "job_matches","career_profiles","documents","evidence_items","user_job_saves"];
for (const t of tabellen) {
  try {
    const [r] = (await db.execute(sql.raw(`select count(*)::int n from ${t}`))).rows;
    console.log(t.padEnd(28), String(r.n).padStart(7));
  } catch (e) { console.log(t.padEnd(28), "  — " + String(e.message).slice(0, 40)); }
}
