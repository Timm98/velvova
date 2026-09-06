import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Stellen je Land auszählen.
 *
 * Läuft im stündlichen Pflegelauf, nicht in der Seite: Das Ergebnis
 * steht im Fuss und damit auf jeder Seite, und ein `group by country`
 * über 2,4 Mio. Zeilen gehört nicht in einen Seitenaufruf.
 *
 * Länder ohne Stellen werden entfernt, nicht auf null gesetzt. Ein
 * Fähnchen mit „0 Stellen" ist schlechter als gar keins — es lädt zu
 * einem Klick ein, der ins Leere führt.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
await db.execute(sql`set statement_timeout = '1800s'`);

/*
 * Je Land einzeln zählen, nicht alles auf einmal gruppieren.
 *
 * `group by country` über den ganzen Bestand ist eine einzige lange
 * Abfrage: gemessen 106 Sekunden warm — und im Pflegelauf lief sie in
 * die Zeitgrenze von 1.800 Sekunden und brach den ganzen Schritt ab.
 * Eine Abfrage, die entweder ganz durchläuft oder gar nichts liefert,
 * ist bei wachsendem Bestand ein Zeitzünder.
 *
 * Neunzehn Einzelzählungen brauchen zusammen 46 Sekunden und nutzen
 * `jobs_land_neueste_idx`, weil dessen erste Spalte das Land ist.
 * Jede für sich ist klein; fällt eine aus, fehlt eine Zahl statt aller.
 *
 * Die Länderliste kommt aus dem bisherigen Bestand vereinigt mit den
 * konfigurierten Märkten — ein neues Land taucht auf, sobald es dort
 * eingetragen ist, und das ist ohnehin nötig, damit es in der
 * Regionsauswahl erscheint.
 */
const { MAERKTE } = await import("../packages/config/src/maerkte.ts");
const bekannt = (await db.execute(sql`select land from laenderbestand`)).rows.map((r) => r.land);
const laender = [...new Set([...bekannt, ...MAERKTE.map((m) => m.countryCode)])].sort();

const t0 = Date.now();
const zeilen = [];
for (const land of laender) {
  try {
    const [c] = (await db.execute(sql`
      select count(*)::bigint n from jobs
      where is_demo = false and country = ${land}`)).rows;
    const n = Number(c.n);
    if (n > 0) zeilen.push({ country: land, n });
  } catch (e) {
    console.error(`  ${land} übersprungen: ${String(e.message).slice(0, 80)}`);
  }
}

const summe = zeilen.reduce((a, z) => a + Number(z.n), 0);
console.log(`${zeilen.length} Länder, ${summe.toLocaleString("de")} Stellen, ${((Date.now()-t0)/1000).toFixed(1)} s`);
process.exit(0);
