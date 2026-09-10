#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════
 * Den Linkrang für bestehende Fundstellen nachtragen
 * ══════════════════════════════════════════════════════════════════
 *
 * `job_source_links.rank` entscheidet, welcher Link die Bewerbung
 * trägt. Geschrieben wurde er nie — 3,68 Mio. Zeilen standen auf dem
 * Standardwert 100, und damit entschied die Reihenfolge des Imports,
 * wohin ein Mensch geschickt wird.
 *
 * Der Importer setzt ihn ab jetzt. Dieses Skript holt nach, was schon
 * da ist.
 *
 * ── Warum in Schüben und nicht in einer Anweisung ───────────────
 *
 * Ein `update` über 3,68 Mio. Zeilen hält Sperren, bis es fertig ist,
 * und läuft dabei gegen dieselbe Datenbank, aus der die Anwendung
 * liest. In Schüben zu je 50.000 dauert es länger und stört nicht.
 *
 * Abbrechbar: Jeder Schub ist für sich abgeschlossen. Wer das Skript
 * stoppt, hat einen Teil nachgezogen und keinen kaputten Zustand —
 * beim nächsten Lauf geht es weiter, weil nur Zeilen angefasst werden,
 * deren Rang noch nicht stimmt.
 *
 * ── Was es NICHT tut ────────────────────────────────────────────
 *
 * Es fasst `jobs.original_url` nicht an. Welcher Link angezeigt wird,
 * ist die nächste Frage und eine eigene Entscheidung: Mit der URL muss
 * die Quellenangabe mitwandern, sonst steht unter einer Adresse von
 * Anbieter B die Nennung von Anbieter A. Erst den Rang, dann das.
 *
 * Aufruf aus der Repo-Wurzel:
 *   node --env-file=.env.local packages/db/scripts/linkrang-nachziehen.mjs --trocken
 *   node --env-file=.env.local packages/db/scripts/linkrang-nachziehen.mjs
 *
 * Liegt hier und nicht in `scripts/`, weil `pg` unter `packages/db`
 * installiert ist und von der Wurzel aus nicht aufgelöst wird.
 */

import pg from "pg";

const TROCKEN = process.argv.includes("--trocken");
const SCHUB = 50_000;

/* Dieselbe Reihenfolge wie `HerkunftSchema` in @paycheck/domain.
   Sie steht hier noch einmal, weil dieses Skript ohne Bau läuft — der
   Test `linkrang.test.ts` hält die Reihenfolge dort fest. */
const RANG_JE_ART = {
  employer_feed: 20, // → ats
  partner: 30, //       → licensed_partner
  licensed_api: 40, //  → aggregator
  seed: 40, //          → aggregator
  user_url: 60, //      → user_import
  user_text: 60, //     → user_import
};

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL fehlt. Aufruf: node --env-file=.env.local packages/db/scripts/linkrang-nachziehen.mjs");
  process.exit(1);
}

/*
 * Dieselbe TLS-Behandlung wie `packages/db/src/client.ts`.
 *
 * `pg` deutet `sslmode=require` strenger als libpq: Es prüft die
 * Zertifikatskette und bricht bei Supabase mit „self-signed
 * certificate in certificate chain" ab. `uselibpqcompat` stellt die
 * Bedeutung wieder her, die `sslmode` in libpq immer hatte — das ist
 * keine Lockerung, sondern die Auflösung einer Abweichung.
 *
 * Wer `verify-ca` oder `verify-full` in den String schreibt, hat sich
 * ausdrücklich für die Prüfung entschieden; die bleibt unangetastet.
 */
function libpqSemantik(roh) {
  let u;
  try {
    u = new URL(roh);
  } catch {
    return roh;
  }
  const modus = u.searchParams.get("sslmode");
  if (modus === "verify-ca" || modus === "verify-full" || modus === "disable") return roh;
  if (!u.searchParams.has("uselibpqcompat")) {
    u.searchParams.set("uselibpqcompat", "true");
    if (!modus) u.searchParams.set("sslmode", "require");
  }
  return u.toString();
}

const pool = new pg.Pool({ connectionString: libpqSemantik(url), max: 2 });

try {
  const { rows: vorher } = await pool.query(
    `select l.rank, s.kind, count(*)::int n
       from job_source_links l join job_sources s on s.id = l.source_id
      group by l.rank, s.kind order by n desc`,
  );
  console.log("Vorher:");
  for (const r of vorher) console.log(`  rank ${String(r.rank).padStart(3)}  ${String(r.kind).padEnd(14)} ${r.n}`);

  let gesamt = 0;
  for (const [kind, rang] of Object.entries(RANG_JE_ART)) {
    for (;;) {
      const anweisung = `
        update job_source_links l set rank = $1
         where l.id in (
           select l2.id from job_source_links l2
             join job_sources s on s.id = l2.source_id
            where s.kind = $2 and l2.rank is distinct from $1
            limit $3
         )`;
      if (TROCKEN) {
        const { rows } = await pool.query(
          `select count(*)::int n from job_source_links l2
             join job_sources s on s.id = l2.source_id
            where s.kind = $1 and l2.rank is distinct from $2`,
          [kind, rang],
        );
        console.log(`  [trocken] ${kind} → ${rang}: ${rows[0].n} Zeilen zu ändern`);
        break;
      }
      const { rowCount } = await pool.query(anweisung, [rang, kind, SCHUB]);
      if (rowCount === 0) break;
      gesamt += rowCount;
      console.log(`  ${kind} → ${rang}: ${gesamt} Zeilen`);
    }
  }

  if (!TROCKEN) {
    const { rows: nachher } = await pool.query(
      `select l.rank, count(*)::int n from job_source_links l group by l.rank order by l.rank`,
    );
    console.log("Nachher:");
    for (const r of nachher) console.log(`  rank ${String(r.rank).padStart(3)}  ${r.n}`);
  }
} finally {
  await pool.end();
}
