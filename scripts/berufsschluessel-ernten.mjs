import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Holt das DKZ-Berufsverzeichnis vollständig in `beruf_schluessel`.
 *
 * ── Warum vollständig und nicht auf Zuruf ─────────────────────
 *
 * Der Entgeltatlas will eine KldB-Kennung („43414"), die Jobbörse
 * liefert Namen („Softwareentwickler/in"). Übersetzen kann der
 * DKZ-Dienst — aber sein Suchparameter ist wirkungslos: `?suchwort=`,
 * `?was=` und `?bezeichnung=` geben alle dieselbe erste Seite zurück.
 * Eine Suche nach „Softwareentwickler" liefert Landwirte.
 *
 * Nachschlagen im Anfragepfad ist damit ausgeschlossen. Bleibt: das
 * Verzeichnis einmal ganz holen. Es sind rund 51.000 Berufe, und danach
 * ist jede Übersetzung eine Abfrage gegen die eigene Tabelle.
 *
 * Aufruf: node --experimental-strip-types scripts/berufsschluessel-ernten.mjs [abSeite]
 */
const { dkzSeite } = await import("../apps/web/src/lib/jobs/entgeltatlas.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const GROESSE = 100;
let seite = Number(process.argv[2] ?? 1);
const t0 = Date.now();
let geschrieben = 0, mitKldb = 0, seiten = 0, doppelt = 0, mehrdeutig = 0;

const erste = await dkzSeite(seite, GROESSE);
seiten = erste.seiten;
console.log(`DKZ-Verzeichnis: ${seiten} Seiten à ${GROESSE}\n`);

for (let s = seite; s <= seiten; s++) {
  let berufe;
  try {
    berufe = s === seite ? erste.berufe : (await dkzSeite(s, GROESSE)).berufe;
  } catch (e) {
    console.log(`  ! Seite ${s}: ${String(e instanceof Error ? e.message : e).slice(0, 70)}`);
    await new Promise((r) => setTimeout(r, 2000));
    continue;
  }

  /*
   * Erst entdoppeln, dann schreiben.
   *
   * Dieselbe Bezeichnung steht im DKZ mehrfach — „Landwirt/in" unter
   * `B 11102-10000` und `B 11102-90000`. Postgres bricht ab, wenn ein
   * INSERT ... ON CONFLICT dieselbe Zeile zweimal anfassen soll:
   * „no rows proposed for insertion within the same command have
   * duplicate constrained values". Der erste Lauf starb daran auf
   * Seite 1.
   *
   * Bei Doppelungen gewinnt ein Satz mit Kennung über einen ohne.
   * Tragen beide eine, aber verschiedene, wird das gezählt — eine
   * Bezeichnung mit zwei Berufsgattungen ist keine Übersetzung, und
   * wie oft das vorkommt, gehört in den Bericht statt in eine
   * stillschweigende Auswahl.
   */
  const jeName = new Map();
  for (const b of berufe) {
    const da = jeName.get(b.name);
    if (!da) { jeName.set(b.name, b); continue; }
    if (da.kldb === null && b.kldb !== null) { jeName.set(b.name, b); continue; }
    if (da.kldb !== null && b.kldb !== null && da.kldb !== b.kldb) mehrdeutig++;
  }
  doppelt += berufe.length - jeName.size;

  /*
   * Ein INSERT je Seite, nicht je Beruf.
   *
   * Bei 51.000 Berufen sind das 511 Anweisungen statt 51.000 — der
   * Unterschied zwischen zwei Minuten und einer Stunde.
   */
  const werte = [...jeName.values()].map(
    (b) => sql`(${b.name}, ${b.kldb}, now())`,
  );
  if (werte.length > 0) {
    await db.execute(sql`
      insert into beruf_schluessel (beruf, schluessel, gefragt_am)
      values ${sql.join(werte, sql`, `)}
      on conflict (beruf) do update
        set schluessel = coalesce(excluded.schluessel, beruf_schluessel.schluessel),
            gefragt_am = now()
    `);
    geschrieben += werte.length;
    mitKldb += [...jeName.values()].filter((b) => b.kldb !== null).length;
  }

  if (s % 25 === 0 || s === seiten) {
    console.log(
      `  ${String(s).padStart(4)}/${seiten} · ${geschrieben} Berufe · ` +
      `${mitKldb} mit KldB (${(100 * mitKldb / Math.max(1, geschrieben)).toFixed(0)} %) · ` +
      `${((Date.now() - t0) / 60000).toFixed(1)} min`,
    );
  }
  await new Promise((r) => setTimeout(r, 120));
}

const eigen = (await db.execute(sql`
  select count(*)::int as gesamt,
         count(schluessel)::int as mit_schluessel,
         count(distinct schluessel)::int as gattungen
  from beruf_schluessel`)).rows[0];
console.log(
  `\nFertig. Tabelle: ${eigen.gesamt} Bezeichnungen, ${eigen.mit_schluessel} mit Kennung, ` +
  `${eigen.gattungen} verschiedene Berufsgattungen.`,
);
console.log(
  `Im Verzeichnis mehrfach genannt: ${doppelt} · davon mit widersprüchlicher Kennung: ${mehrdeutig}`,
);
process.exit(0);
