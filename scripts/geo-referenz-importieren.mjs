import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die Ortsreferenz aus den GeoNames-Postleitzahlen aufbauen.
 *
 * ══════════════════════════════════════════════════════════════
 * Woher die Daten kommen und unter welcher Bedingung
 * ══════════════════════════════════════════════════════════════
 *
 * Quelle:  https://download.geonames.org/export/zip/DE.zip
 * Lizenz:  Creative Commons Attribution 4.0, laut `readme.txt` der
 *          Quelle (geprüft am 6. September 2026)
 *
 * Die Lizenz verlangt Namensnennung. Sie steht in `quelle` und
 * `quelle_fassung` an jeder einzelnen Zeile, nicht nur hier im
 * Kommentar — eine Herkunftsangabe, die man beim Löschen der Datei
 * verliert, ist keine.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum eine eigene Tabelle statt weiterer Nominatim-Anfragen
 * ══════════════════════════════════════════════════════════════
 *
 * Der Bestand hat 472 verschiedene Ortsangaben, und das ist der
 * heutige Stand — er wächst mit jedem Import. Die Hälfte davon steht
 * bereits in `geo_orte`, weil sie schon einmal für einen Arbeitsweg
 * aufgelöst wurde. Die andere Hälfte über Nominatim nachzuholen hiesse
 * bei einer Anfrage je Sekunde vier Minuten für heute und dieselbe
 * Rechnung wieder bei jedem Import.
 *
 * Ein fremder Dienst mit einer Anfrage je Sekunde ist kein Fundament
 * für einen Abgleich, der nachts über tausende Stellen läuft. Eine
 * lokale Tabelle mit 23.000 Zeilen ist eins.
 *
 * ══════════════════════════════════════════════════════════════
 * Zwei Arten von Zeilen, und warum die Unterscheidung nötig ist
 * ══════════════════════════════════════════════════════════════
 *
 * Die deutsche Postleitzahlenliste enthält Grosskunden-Postleitzahlen.
 * Deren „Ortsname" ist ein Firmenname:
 *
 *   10096  Berliner Verkehrsbetriebe (BVG) Anstalt des öffentlichen Rechts
 *   70546  Daimler Brand und IP Management GmbH & Co.KG
 *
 * Für die Postleitzahl sind das gültige Zeilen — wer „10096 Berlin"
 * schreibt, soll einen Punkt bekommen. Als Ortsname sind sie Gift:
 * Eine Anzeige der BVG würde über den Firmennamen „aufgelöst" und
 * landete irgendwo.
 *
 * Deshalb tragen sie eine eigene `quelle`. Die Namenssuche filtert
 * darauf, die Postleitzahlensuche nicht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum zusätzlich Zeilen ohne Postleitzahl entstehen
 * ══════════════════════════════════════════════════════════════
 *
 * Karlsruhe hat 30 Postleitzahlen und damit 30 Zeilen, deren
 * Koordinaten sich um wenige Kilometer unterscheiden. Eine Anzeige
 * schreibt aber meist nur „Karlsruhe".
 *
 * Für diesen Fall entsteht je Ort und Bundesland eine zusätzliche
 * Zeile mit `plz = NULL`, deren Koordinate der Mittelpunkt aller
 * zugehörigen Postleitzahlen ist und deren `plz_anzahl` sagt, aus
 * wie vielen sie gebildet wurde. Bei einem Umkreis von dreissig
 * Kilometern ist der Unterschied zwischen Stadtmitte und Stadtrand
 * verschmerzbar — bei einem von drei Kilometern nicht, und dann sagt
 * `plz_anzahl`, wie grob der Punkt ist.
 *
 * Aufruf: node --experimental-strip-types scripts/geo-referenz-importieren.mjs <DE.txt> [--trocken]
 */

const { ortNormalisieren } = await import("../packages/matching/src/ortsaufloesung.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { readFile } = await import("node:fs/promises");

const datei = process.argv[2];
const trocken = process.argv.includes("--trocken");
if (!datei) {
  console.error("Aufruf: geo-referenz-importieren.mjs <pfad/zu/DE.txt> [--trocken]");
  process.exit(1);
}

const LAND = "de";
/*
 * GeoNames versioniert die Datei nicht. Das Bezugsdatum ist deshalb
 * der Tag des Herunterladens — die einzige Angabe, die wir ehrlich
 * machen können. Sie steht im eindeutigen Index, damit ein späterer
 * Stand danebengelegt werden kann, ohne den alten zu überschreiben.
 *
 * Welcher Stand gilt, entscheidet nicht dieses Skript, sondern
 * `GEO_REFERENZ_FASSUNG`. Sonst schriebe der Import einen Stand, den
 * die Auflösung nicht liest, und niemand sähe es.
 */
const { GEO_REFERENZ_FASSUNG: FASSUNG } = await import("../packages/jobs/src/geodaten.ts");

/** Zeilen, deren „Ortsname" ein Firmenname ist. */
const FIRMENNAME =
  /(GmbH|mbH|\bAG\b|\bKG\b|\be\.? ?V\.?\b|\bSE\b|Co\.|Anstalt|Stiftung|Postfach|Aktiengesellschaft|Verwaltung|Versand|Deutsche Post)/;

const roh = await readFile(datei, "utf8");
const zeilen = roh.split("\n").filter((z) => z.trim().length > 0);

/** Was in die Datenbank soll, entdoppelt über den eindeutigen Schlüssel. */
const eintraege = new Map();
/** Sammlung je Ort und Bundesland, für die Mittelpunktzeile. */
const orte = new Map();

let ohneKoordinate = 0;
let firmenzeilen = 0;

for (const zeile of zeilen) {
  const f = zeile.split("\t");
  const plz = (f[1] ?? "").trim();
  const name = (f[2] ?? "").trim();
  const region = (f[3] ?? "").trim() || null;
  /*
   * Der Kreis steht in `admin3name` — in 23.296 von 23.297 Zeilen
   * gefüllt. Das Wort “Landkreis” davor ist Formsache; die Anzeige
   * schreibt “Barnim (Kreis)”, die Quelle “Landkreis Barnim”.
   */
  const kreis =
    ((f[7] ?? "").trim().replace(/^(Land|Stadt)?kreis\s+/i, "").replace(/^Kreisfreie Stadt\s+/i, "") ||
      null);
  const breite = Number(f[9]);
  const laenge = Number(f[10]);

  if (!plz || !name || !Number.isFinite(breite) || !Number.isFinite(laenge)) {
    ohneKoordinate++;
    continue;
  }

  const istFirma = FIRMENNAME.test(name);
  if (istFirma) firmenzeilen++;
  const quelle = istFirma ? "geonames_zip_grosskunde" : "geonames_zip";
  const nameNorm = ortNormalisieren(name);
  if (nameNorm.length < 2) continue;

  const schluessel = `${nameNorm}|${region ?? ""}|${kreis ?? ""}|${plz}`;
  eintraege.set(schluessel, {
    nameNorm,
    name,
    region,
    kreis,
    plz,
    breite,
    laenge,
    quelle,
  });

  /*
   * Firmenzeilen gehen nicht in den Mittelpunkt ein. Sonst zöge der
   * Firmensitz den Stadtmittelpunkt zu sich — und der Ortsname, unter
   * dem die Firma gelistet ist, ist ohnehin ihrer.
   */
  if (istFirma) continue;
  /*
   * Der Kreis gehört in den Schlüssel der Mittelpunktzeile.
   *
   * Sonst mittelt sie zwei gleichnamige Orte desselben Bundeslands
   * zusammen — und der Punkt landet dort, wo keiner von beiden liegt.
   */
  const ortSchluessel = `${nameNorm}|${region ?? ""}|${kreis ?? ""}`;
  const vorhanden = orte.get(ortSchluessel);
  if (vorhanden) {
    vorhanden.breite += breite;
    vorhanden.laenge += laenge;
    vorhanden.n += 1;
  } else {
    orte.set(ortSchluessel, { nameNorm, name, region, kreis, breite, laenge, n: 1 });
  }
}

/* Die Mittelpunktzeilen. */
for (const [schluessel, o] of orte) {
  eintraege.set(`${schluessel}|`, {
    nameNorm: o.nameNorm,
    name: o.name,
    region: o.region,
    kreis: o.kreis,
    plz: null,
    breite: o.breite / o.n,
    laenge: o.laenge / o.n,
    quelle: "geonames_zip",
    plzAnzahl: o.n,
  });
}

const alle = [...eintraege.values()];
console.log(
  [
    `Datei:              ${datei}`,
    `Zeilen gelesen:     ${zeilen.length}`,
    `  ohne Koordinate:  ${ohneKoordinate}`,
    `  Grosskunden-PLZ:  ${firmenzeilen}`,
    `Verschiedene Orte:  ${orte.size}`,
    `Zu schreiben:       ${alle.length}`,
  ].join("\n"),
);

if (trocken) {
  console.log("\nTrockenlauf — nichts geschrieben.");
  process.exit(0);
}

const db = await getDb();

/*
 * In Stapeln, mit `ON CONFLICT DO NOTHING`.
 *
 * Damit ist der Import wiederaufnehmbar: Bricht er nach der Hälfte ab,
 * schreibt der nächste Lauf die fehlende Hälfte und lässt die erste in
 * Ruhe. Keine lange offene Transaktion, kein Zustand, den man vor dem
 * zweiten Versuch aufräumen müsste.
 */
const STAPEL = 500;
let geschrieben = 0;
for (let i = 0; i < alle.length; i += STAPEL) {
  const stapel = alle.slice(i, i + STAPEL);
  const werte = stapel.map(
    (e) =>
      sql`(${LAND}, ${e.nameNorm}, ${e.name}, ${e.region}, ${e.kreis}, ${e.plz}, ${e.breite}, ${e.laenge}, ${e.plzAnzahl ?? 1}, ${e.quelle}, ${FASSUNG})`,
  );
  /*
   * `do update` statt `do nothing`, damit ein zweiter Lauf einen
   * nachgetragenen Kreis auch wirklich schreibt. Idempotent bleibt es
   * trotzdem: Zweimal derselbe Wert ist derselbe Wert.
   */
  const ergebnis = await db.execute(sql`
    insert into geo_referenz
      (land, name_norm, name, region, kreis, plz, latitude, longitude, plz_anzahl, quelle, quelle_fassung)
    values ${sql.join(werte, sql`, `)}
    on conflict (land, name_norm, coalesce(region, ''), coalesce(kreis, ''), coalesce(plz, ''), quelle_fassung)
    do update set
      kreis = excluded.kreis,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      plz_anzahl = excluded.plz_anzahl,
      name = excluded.name
  `);
  geschrieben += ergebnis.rowCount ?? 0;
  if (i % (STAPEL * 20) === 0) {
    process.stdout.write(`\r  ${i + stapel.length} / ${alle.length}`);
  }
}
process.stdout.write(`\r  ${alle.length} / ${alle.length}\n`);

const stand = await db.execute(sql`
  select quelle, count(*)::int as n, count(plz)::int as mit_plz
  from geo_referenz where land = ${LAND} group by quelle order by quelle
`);
console.log(`\nNeu geschrieben: ${geschrieben}`);
console.log("Bestand in geo_referenz:");
for (const r of stand.rows) {
  console.log(`  ${r.quelle.padEnd(26)} ${String(r.n).padStart(6)}  davon mit PLZ ${r.mit_plz}`);
}
process.exit(0);
