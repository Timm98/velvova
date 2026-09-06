import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die fehlenden Suchindizes anlegen — ohne die Importe anzuhalten.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das nicht die Migration erledigt hat
 * ══════════════════════════════════════════════════════════════
 *
 * Migration 0061 legt sie mit `create index` an — das sperrt die
 * Tabelle für Schreibzugriffe. Auf 2,6 Mio. Zeilen dauert das Minuten,
 * und in dieser Zeit steht jeder laufende Import.
 *
 * Die Migration ist deshalb für frische Umgebungen gedacht. Auf einer
 * Datenbank, die schon läuft, gehört `concurrently` her: zwei
 * Durchläufe statt einem, dafür keine Sperre. Es läuft nicht in einer
 * Transaktion und kann darum nicht im Migrationsläufer stehen.
 *
 * ══════════════════════════════════════════════════════════════
 * Was passiert, wenn sie fehlen
 * ══════════════════════════════════════════════════════════════
 *
 * Gemessen am 6. September 2026 an 2.599.863 Zeilen: Die Jobseite
 * brauchte 97 Sekunden ohne Suchbegriff und lief mit einem in den
 * Statement-Timeout. Für die Person sieht das aus wie eine kaputte
 * Seite — und der Grund steht nirgends, weil ein fehlender Index
 * keine Fehlermeldung erzeugt, sondern nur Zeit.
 *
 * ── Ein abgebrochener Lauf hinterlässt Spuren ────────────────
 *
 * `create index concurrently` lässt bei einem Abbruch einen Index im
 * Zustand `invalid` zurück. Er wird nicht benutzt, belegt aber Platz.
 * Dieses Skript findet und entfernt ihn vor dem nächsten Versuch —
 * sonst scheitert `if not exists` daran, dass der kaputte Index
 * bereits existiert.
 *
 * Aufruf: node --experimental-strip-types scripts/volltext-indizes.mjs
 */

const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/* Eine Stunde. Ein GIN-Index über 2,6 Mio. Zeilen braucht Minuten,
   und unter Importlast auch mehr. */
await db.execute(sql`set statement_timeout = '3600s'`);

const INDIZES = [
  {
    name: "jobs_volltext_idx",
    was: "Volltext über den Stellentitel (deutsch gestemmt)",
    anweisung: sql`create index concurrently if not exists jobs_volltext_idx
      on jobs using gin (to_tsvector('german', title))
      where is_demo = false`,
  },
  {
    name: "jobs_ort_idx",
    was: "Wortsuche über den Ort (ungestemmt)",
    anweisung: sql`create index concurrently if not exists jobs_ort_idx
      on jobs using gin (to_tsvector('simple', location))
      where is_demo = false`,
  },
  {
    name: "jobs_url_quelle_idx",
    was: "Der Nachschlag des Imports: dieselbe Adresse bei derselben Quelle",
    anweisung: sql`create index concurrently if not exists jobs_url_quelle_idx
      on jobs (original_url, source_id)`,
  },
  {
    name: "jobs_neueste_idx",
    was: "Die neuesten Anzeigen ohne Filter",
    anweisung: sql`create index concurrently if not exists jobs_neueste_idx
      on jobs (published_at desc nulls last)
      where is_demo = false`,
  },
];

const vorhanden = async (name) =>
  (
    await db.execute(sql`
      select i.indisvalid
        from pg_class c join pg_index i on i.indexrelid = c.oid
       where c.relname = ${name}`)
  ).rows[0] ?? null;

for (const idx of INDIZES) {
  const stand = await vorhanden(idx.name);

  if (stand?.indisvalid === true) {
    console.log(`✓ ${idx.name} — steht bereits`);
    continue;
  }

  if (stand && stand.indisvalid === false) {
    console.log(`✗ ${idx.name} — kaputt aus einem abgebrochenen Lauf, wird entfernt`);
    await db.execute(sql.raw(`drop index concurrently if exists ${idx.name}`));
  }

  console.log(`… ${idx.name} — ${idx.was}`);
  const t = Date.now();
  try {
    await db.execute(idx.anweisung);
    const danach = await vorhanden(idx.name);
    console.log(
      `  ${danach?.indisvalid ? "angelegt" : "NICHT gültig"} in ${Math.round((Date.now() - t) / 1000)} s`,
    );
  } catch (fehler) {
    /*
     * Ein gescheiterter Index bricht die anderen nicht ab.
     *
     * Sie sind unabhängig voneinander, und zwei von drei sind besser
     * als keiner. Was fehlt, steht am Ende in der Übersicht.
     */
    console.log(`  fehlgeschlagen nach ${Math.round((Date.now() - t) / 1000)} s: ${fehler.message.slice(0, 120)}`);
  }
}

console.log("\n── Stand ──────────────────────────────────────────");
for (const idx of INDIZES) {
  const stand = await vorhanden(idx.name);
  console.log(`  ${idx.name.padEnd(20)} ${stand?.indisvalid ? "gültig" : stand ? "ungültig" : "fehlt"}`);
}
process.exit(0);
