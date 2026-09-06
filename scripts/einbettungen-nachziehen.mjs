import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Fehlende Job-Einbettungen aufbauen, bis keine mehr fehlen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es dieses Skript gibt
 * ══════════════════════════════════════════════════════════════
 *
 * `einbettungenNachziehen` holt je Aufruf höchstens
 * `EINBETTUNG_JE_LAUF` Stellen nach — 200. Das ist für eine
 * Suchauftragsrunde richtig: Eine Runde soll nicht an einem
 * Einbettungsanbieter hängen.
 *
 * Es heisst aber auch, dass der Bestand nur wächst, wenn jemand oft
 * genug eine Runde startet. Gemessen am 6. September 2026: 200 von
 * 1209 analysierten Stellen hatten eine Einbettung — der Rest war für
 * die semantische Suche unsichtbar, seit Wochen, ohne Fehlermeldung.
 *
 * ── Warum nicht einfach die Grenze hochsetzen ─────────────────
 *
 * Weil die Grenze für die Runde stimmt und für den Aufbau nicht. Zwei
 * verschiedene Aufgaben, zwei verschiedene Zahlen. Die Runde bleibt
 * schnell, der Aufbau läuft hier — und man sieht, was er kostet.
 *
 * Aufruf: node --experimental-strip-types scripts/einbettungen-nachziehen.mjs [maxstellen]
 */

const { einbettungenNachziehen, EINBETTUNG_STAPEL } = await import(
  "../packages/jobs/src/suchauftrag/einbettung.ts"
);
const { selectProvider } = await import("../packages/ai/src/index.ts");
const { loadRuntimeConfig } = await import("../packages/config/src/index.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");

const db = await getDb();
const cfg = loadRuntimeConfig();
const modell = { name: cfg.ai.modelEmbed, stapel: EINBETTUNG_STAPEL };

/*
 * Eine Obergrenze, die der Aufrufer setzt und nicht das Skript.
 *
 * Ein Lauf, der „alles" einbettet, ohne dass jemand vorher weiss
 * wieviel, ist eine Rechnung, die man erst hinterher sieht.
 */
const maxStellen = Number(process.argv[2] ?? 1500);

const zaehlen = async () => {
  const r = await db.execute(sql`
    select
      count(*)::int as bestand,
      count(e.id)::int as mit_einbettung
    from job_analysen a
    join jobs j on j.id = a.job_id
    left join job_einbettungen e on e.job_id = j.id and e.modell = ${modell.name}
    where a.status = 'fertig'
  `);
  return r.rows[0];
};

const vorher = await zaehlen();
console.log(
  `Modell: ${modell.name}\n` +
    `Vorher: ${vorher.mit_einbettung} / ${vorher.bestand} eingebettet\n` +
    `Obergrenze dieses Laufs: ${maxStellen} Stellen\n`,
);

let zeichen = 0;
const einbetter = async (texte) => {
  zeichen += texte.reduce((n, t) => n + t.length, 0);
  const provider = await selectProvider(cfg);
  return provider.embed(texte);
};

const gesamt = { neu: 0, unveraendert: 0, gescheitert: 0 };
const STAPEL = 200;
for (let getan = 0; getan < maxStellen; getan += STAPEL) {
  const lauf = await einbettungenNachziehen(db, modell, einbetter, Math.min(STAPEL, maxStellen - getan));
  if (lauf.neu === 0 && lauf.gescheitert === 0) break;
  gesamt.neu += lauf.neu;
  gesamt.unveraendert += lauf.unveraendert;
  gesamt.gescheitert += lauf.gescheitert;
  process.stdout.write(`\r  neu ${gesamt.neu} · unverändert ${gesamt.unveraendert} · gescheitert ${gesamt.gescheitert}`);
}
process.stdout.write("\n");

const nachher = await zaehlen();
/*
 * Die Kostenschätzung ist eine Schätzung und heisst deshalb so.
 * Vier Zeichen je Merkmal ist die grobe Faustregel für deutschen
 * Text; die Abrechnung des Anbieters ist die einzige Wahrheit.
 */
const merkmale = Math.round(zeichen / 4);
console.log(
  [
    "",
    `Nachher: ${nachher.mit_einbettung} / ${nachher.bestand} eingebettet ` +
      `(${((nachher.mit_einbettung / nachher.bestand) * 100).toFixed(1)} %)`,
    `Gesendet: ~${merkmale.toLocaleString("de-DE")} Merkmale (${zeichen.toLocaleString("de-DE")} Zeichen)`,
    `Schätzung: ~${((merkmale / 1_000_000) * 2).toFixed(2)} Cent bei 0,02 $ je Million`,
  ].join("\n"),
);
process.exit(0);
