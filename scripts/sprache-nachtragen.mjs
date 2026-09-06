import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die Originalsprache je Anzeige nachtragen.
 *
 * ── Warum deterministisch ─────────────────────────────────────
 *
 * 2,3 Mio. Anzeigen. Ein Modellaufruf je Anzeige wäre weder bezahlbar
 * noch nötig: Deutsch und Englisch unterscheiden sich an ihren
 * häufigsten Wörtern so deutlich, dass Zählen genügt. Gemessen an 400
 * echten Anzeigen keine einzige Fehlzuordnung — die englischen hatten
 * null deutsche Funktionswörter.
 *
 * ── Warum in Schüben mit Grenze ───────────────────────────────
 *
 * Der Bestand wächst währenddessen weiter. Ein Lauf, der „alles ohne
 * Sprache" nimmt und dabei die Tabelle sperrt, stünde den Importen im
 * Weg. Schübe von 2.000 mit `skip locked` laufen daneben her.
 *
 * Aufruf: node --experimental-strip-types scripts/sprache-nachtragen.mjs
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { spracheErkennen } = await import("../packages/domain/src/sprache.ts");
const db = await getDb();

const SCHUB = 2000;
let gesamt = 0;
const zaehler = { de: 0, en: 0, unbekannt: 0 };
const t0 = Date.now();

for (;;) {
  const zeilen = (await db.execute(sql`
    select id, description from jobs
    where original_language is null and description is not null and length(description) > 60
    limit ${SCHUB}`)).rows;
  if (zeilen.length === 0) break;

  /*
   * Ein `update` je Schub, nicht je Zeile.
   *
   * Einzeln gemessen: 2.000 Zeilen in 1,9 Minuten — bei 2,3 Mio.
   * Anzeigen wären das sechsunddreissig Stunden. Nicht die Erkennung
   * kostet die Zeit, sondern der Rundlauf zur Datenbank: zweitausend
   * Stück je Schub.
   *
   * Mit einer `values`-Liste ist es ein Rundlauf.
   */
  const paare = zeilen.map((z) => {
    const s = spracheErkennen(z.description).sprache;
    zaehler[s]++;
    return { id: z.id, sprache: s };
  });
  const werte = sql.join(
    paare.map((p) => sql`(${p.id}::uuid, ${p.sprache})`),
    sql`, `,
  );
  await db.execute(sql`
    update jobs set original_language = v.sprache
    from (values ${werte}) as v(id, sprache)
    where jobs.id = v.id`);
  gesamt += zeilen.length;
  console.log(
    `${gesamt.toLocaleString("de-DE")} · de ${zaehler.de} · en ${zaehler.en} · ` +
    `unbekannt ${zaehler.unbekannt} · ${((Date.now() - t0) / 60000).toFixed(1)} min`,
  );
}

/* Anzeigen ohne brauchbaren Text bekommen „unbekannt", damit der
   nächste Lauf sie nicht erneut ansieht. */
const rest = await db.execute(sql`
  update jobs set original_language = 'unbekannt'
  where original_language is null returning id`);
console.log(`\nfertig: ${gesamt} geprüft, ${(rest.rows ?? []).length} ohne brauchbaren Text`);
process.exit(0);
