import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Belege aus Arbeitsproben nachtragen, die vor dem Erfassen liefen.
 *
 * ── Warum das kein Erfinden von Daten ist ─────────────────────
 *
 * Die Durchläufe sind passiert: Jemand hat eine Aufgabe gelöst und
 * gesagt, wie es sich angefühlt hat. Nur die Zeile in `evidence_items`
 * fehlt, weil es den Erzeuger damals nicht gab. Was hier entsteht,
 * steht bereits in `probendurchlaeufe` — es wird nichts geschätzt und
 * nichts angenommen.
 *
 * Textaufgaben bleiben aussen vor: Dort wird nichts bewertet, ein
 * Beleg über Können wäre eine Behauptung im Gewand einer Beobachtung.
 */

const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const frag = async (text) => (await db.execute(sql.raw(text))).rows ?? [];

const laeufe = await frag(`
  select d.id, d.user_id, d.richtig, d.energie, d.dauer_sekunden, p.titel
  from probendurchlaeufe d
  join aufgabenproben p on p.id = d.probe_id
  where not exists (
    select 1 from evidence_items e
    where e.user_id = d.user_id and e.source_ref = 'probe:' || p.titel
  )
  order by d.erstellt_am`);

console.log(`Durchläufe ohne Beleg: ${laeufe.length}`);

let geschrieben = 0;
let uebersprungen = 0;
const gesehen = new Set();

for (const l of laeufe) {
  const energie = l.energie ?? 3;
  const richtig = l.richtig;
  /* Bei einer Textaufgabe wird nichts bewertet — nichts zu beobachten. */
  if (richtig === null) { uebersprungen++; continue; }

  /* Ein Beleg je Probe und Nutzer — sonst zählt Wiederholung als Stärke. */
  const schluessel = `${l.user_id}:${l.titel}`;
  if (gesehen.has(schluessel)) { uebersprungen++; continue; }
  gesehen.add(schluessel);

  const teile = [];
  if (richtig === true) teile.push("hat sie wie üblich gelöst");
  if (richtig === false) teile.push("hat sie anders gelöst als üblich");
  if (energie >= 4) teile.push("und sagt, sie habe Energie gegeben");
  if (energie <= 2) teile.push("und sagt, sie habe Energie gekostet");
  if (teile.length === 0) { uebersprungen++; continue; }

  const aussage = `Arbeitsprobe „${l.titel}“: ${teile.join(", ")} (${Math.max(1, Math.round(l.dauer_sekunden ?? 0))} Sekunden).`;

  await db.execute(sql`
    insert into evidence_items
      (user_id, type, statement, source_type, source_ref, confidence, user_confirmed, geteilt)
    values (${l.user_id}::uuid, 'result', ${aussage}, 'work_sample',
            ${"probe:" + l.titel}, 0.9, true, false)`);
  geschrieben++;
}

console.log(`geschrieben ${geschrieben}, übersprungen ${uebersprungen}`);
