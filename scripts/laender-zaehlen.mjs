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
/*
 * Auch die Länder, die tatsächlich im Bestand stehen.
 *
 * Vorher kam die Liste nur aus der bisherigen Tabelle vereinigt mit
 * den konfigurierten Märkten. Ein Land, das über eine Quelle
 * hereinkommt, ohne als Markt eingetragen zu sein, tauchte damit nie
 * auf — gemessen am 8. September 2026 waren das JP mit 3.788, SE mit
 * 2 und IE mit einer Stelle. Sie fehlten nicht, weil sie leer waren,
 * sondern weil niemand nach ihnen gefragt hat.
 *
 * `distinct country` ist über den Index billig und braucht keine
 * Zählung.
 */
const imBestand = (await db.execute(sql`
  select distinct country from jobs where country is not null`)).rows.map((r) => r.country);
const laender = [...new Set([...bekannt, ...MAERKTE.map((m) => m.countryCode), ...imBestand])].sort();

const t0 = Date.now();
const zeilen = [];
for (const land of laender) {
  try {
    /*
     * Abgelaufene Stellen zählen nicht mit.
     *
     * Der Fuss führt zu einer Trefferliste. Eine Zahl, die abgelaufene
     * Anzeigen einschliesst, verspricht mehr, als die Liste zeigt —
     * und das fällt genau der Person auf, die daraufklickt.
     */
    const [c] = (await db.execute(sql`
      select count(*)::bigint n from jobs
      where is_demo = false and country = ${land}
        and (expires_at is null or expires_at > now())`)).rows;
    const n = Number(c.n);
    if (n > 0) zeilen.push({ country: land, n });
  } catch (e) {
    console.error(`  ${land} übersprungen: ${String(e.message).slice(0, 80)}`);
  }
}

const summe = zeilen.reduce((a, z) => a + Number(z.n), 0);
console.log(`${zeilen.length} Länder, ${summe.toLocaleString("de")} Stellen, ${((Date.now()-t0)/1000).toFixed(1)} s`);

/*
 * ══════════════════════════════════════════════════════════════
 * Und jetzt das Ergebnis auch hinschreiben
 * ══════════════════════════════════════════════════════════════
 *
 * Hier stand `process.exit(0)`. Das Skript zählte neunzehn Länder,
 * gab eine zufriedenstellende Zeile aus und warf das Ergebnis weg.
 *
 * Sichtbar wurde es erst am Bild: Der Fuss zeigte am 8. September 2026
 * 2.498.075 Stellen, während der Bestand bei 3.486.049 lag — jedes
 * Land zu niedrig, drei Länder gar nicht vorhanden. Die Zahlen waren
 * nicht falsch gerechnet, sie waren nie geschrieben worden.
 *
 * Ein Lauf ohne Zeilen schreibt nichts. Wären alle Zählungen
 * fehlgeschlagen, würde ein `delete` sonst den Fuss leeren und das
 * als Ergebnis ausgeben.
 */
if (zeilen.length === 0) {
  console.error("Keine Zählung gelungen — Tabelle bleibt unverändert.");
  process.exit(1);
}

const werte = sql.join(
  zeilen.map((z) => sql`(${z.country}, ${z.n}, now())`),
  sql`, `,
);
await db.execute(sql`
  insert into laenderbestand (land, stellen, berechnet_am)
  values ${werte}
  on conflict (land) do update
    set stellen = excluded.stellen, berechnet_am = excluded.berechnet_am`);

/* Länder ohne Stellen verschwinden, statt auf null zu stehen — siehe
   oben: ein Fähnchen mit „0 Stellen" lädt zu einem Klick ins Leere. */
const behalten = sql.join(zeilen.map((z) => sql`${z.country}`), sql`, `);
const weg = await db.execute(sql`delete from laenderbestand where land not in (${behalten})`);
console.log(`geschrieben: ${zeilen.length} Länder, entfernt: ${weg.rowCount ?? 0}`);
process.exit(0);
