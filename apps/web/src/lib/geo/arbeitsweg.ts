import { eq } from "drizzle-orm";
import { schreibweisen } from "./schreibweisen.ts";
import { getDb, schema } from "@paycheck/db";
import {
  geokodieren,
  verfuegbareModi,
  wegBerechnen,
  type Koordinate,
  type Verkehrsmittel,
  type Wegstrecke,
} from "./anbieter.ts";

/**
 * Der Arbeitsweg — mit Zwischenspeicher davor.
 *
 * ── Warum der Zwischenspeicher nicht optional ist ─────────────
 *
 * Nominatim und OSRM sind öffentliche Dienste mit Nutzungsregeln. Eine
 * Jobseite, die bei jedem Aufruf vier Routen anfragt, wäre bei
 * dreissig Besuchern in der Minute ein Problem — für die Dienste und
 * für uns.
 *
 * Deshalb: erst die Datenbank, dann das Netz. Eine Strecke wird genau
 * einmal erfragt, ein Ortsname genau einmal aufgelöst. Auch
 * Misserfolge werden vermerkt, sonst wird „Germany" bei jedem Aufruf
 * erneut gesucht.
 *
 * ── Warum die Koordinaten gerundet werden ─────────────────────
 *
 * Auf drei Nachkommastellen, also rund hundert Meter. Feiner brächte
 * für eine Angabe in Minuten nichts und machte den Zwischenspeicher
 * nutzlos: Jede Anfrage bekäme einen eigenen Eintrag.
 */

const HALTBAR_TAGE = 60;

function normalisiert(ort: string): string {
  return ort.trim().toLowerCase().replace(/\s+/g, " ");
}

function alt(datum: Date): boolean {
  return Date.now() - datum.getTime() > HALTBAR_TAGE * 24 * 60 * 60 * 1000;
}

/** Einen Ortsnamen auflösen — aus dem Zwischenspeicher oder frisch. */
export async function ortAufloesen(
  ort: string | null | undefined,
  land?: string | null,
): Promise<Koordinate | null> {
  if (!ort) return null;
  const roh = normalisiert(ort);
  if (roh.length < 2) return null;

  /*
   * Das Land gehört in den Zwischenspeicher-Schlüssel, nicht nur in
   * die Anfrage.
   *
   * Ohne es stünde die einmal falsch aufgelöste „hamburg, hamburg"
   * (New York) für alle Länder in der Tabelle — und der nächste
   * deutsche Treffer bekäme sie ausgeliefert, ohne dass noch einmal
   * gefragt würde. Ein Zwischenspeicher mit zu grobem Schlüssel ist
   * schlimmer als keiner: Er hält den Fehler fest.
   */
  const kuerzel = land?.trim().toLowerCase() ?? "";
  const q = /^[a-z]{2}$/.test(kuerzel) ? `${kuerzel}:${roh}` : roh;

  /*
   * Reine Landesnamen werden nicht aufgelöst.
   *
   * „Germany" und „Deutschland" stehen bei 98 Anzeigen als Ort. Ein
   * Punkt in der Mitte des Landes ergäbe eine Fahrzeit, die für
   * niemanden stimmt — und sie sähe aus wie eine Auskunft.
   */
  if (/^(deutschland|germany|österreich|austria|schweiz|switzerland|remote|homeoffice)$/.test(q)) {
    return null;
  }

  const db = await getDb();
  const [zeile] = await db
    .select()
    .from(schema.geoOrte)
    .where(eq(schema.geoOrte.abfrage, q))
    .limit(1);

  if (zeile && !alt(zeile.gefragtAm)) {
    if (!zeile.gefunden || zeile.latitude === null || zeile.longitude === null) return null;
    return { lat: zeile.latitude, lon: zeile.longitude, name: zeile.anzeigename ?? undefined };
  }

  /*
   * Mehrere Schreibweisen versuchen, von genau nach grob.
   *
   * Die Leiter steht in `schreibweisen.ts` und ist dort geprüft —
   * hier wäre sie eine Regel ohne Test.
   */
  let frisch: Koordinate | null = null;
  for (const form of schreibweisen(ort)) {
    frisch = await geokodieren(form, land);
    if (frisch) break;
  }

  await db
    .insert(schema.geoOrte)
    .values({
      abfrage: q,
      latitude: frisch?.lat ?? null,
      longitude: frisch?.lon ?? null,
      anzeigename: frisch?.name ?? null,
      gefunden: frisch !== null,
      gefragtAm: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.geoOrte.abfrage,
      set: {
        latitude: frisch?.lat ?? null,
        longitude: frisch?.lon ?? null,
        anzeigename: frisch?.name ?? null,
        gefunden: frisch !== null,
        gefragtAm: new Date(),
      },
    })
    .catch((e) => {
      /* Ein voller Zwischenspeicher darf die Seite nicht anhalten. */
      console.error("[geo] Ort nicht gespeichert:", e);
    });

  return frisch;
}

const runde = (n: number) => Math.round(n * 1000) / 1000;

async function streckeMitCache(
  von: Koordinate,
  nach: Koordinate,
  modus: Verkehrsmittel,
): Promise<Wegstrecke | null> {
  const schluessel = `${runde(von.lat)},${runde(von.lon)}>${runde(nach.lat)},${runde(nach.lon)}|${modus}`;
  const db = await getDb();

  const [zeile] = await db
    .select()
    .from(schema.geoWege)
    .where(eq(schema.geoWege.schluessel, schluessel))
    .limit(1);

  if (zeile && !alt(zeile.gefragtAm)) {
    if (!zeile.gefunden || zeile.minuten === null) return null;
    return { modus, minuten: zeile.minuten, kilometer: zeile.kilometer ?? 0 };
  }

  const frisch = await wegBerechnen(von, nach, modus);

  await db
    .insert(schema.geoWege)
    .values({
      schluessel,
      modus,
      minuten: frisch?.minuten ?? null,
      kilometer: frisch?.kilometer ?? null,
      gefunden: frisch !== null,
      gefragtAm: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.geoWege.schluessel,
      set: {
        minuten: frisch?.minuten ?? null,
        kilometer: frisch?.kilometer ?? null,
        gefunden: frisch !== null,
        gefragtAm: new Date(),
      },
    })
    .catch((e) => console.error("[geo] Weg nicht gespeichert:", e));

  return frisch;
}

export interface Arbeitswegbefund {
  /** Was sich ermitteln liess — leer, wenn nichts. */
  strecken: Wegstrecke[];
  /** Warum nichts dasteht. `null`, wenn etwas dasteht. */
  grund: string | null;
  /** Der aufgelöste Zielort, für die Anzeige. */
  zielname?: string;
}

/**
 * Der Weg von zu Hause zur Stelle.
 *
 * Die Reihenfolge der Verkehrsmittel ist bewusst: Auto zuerst, weil es
 * für die meisten Wege in Deutschland die Vergleichsgrösse ist, dann
 * Rad und zu Fuss. Öffentlicher Verkehr fehlt und sagt das auch —
 * dafür bräuchte es Fahrpläne, und eine Autozeit mit einem Faktor
 * multipliziert wäre eine erfundene Zahl.
 */
export async function arbeitswegBerechnen(
  wohnort: string | null | undefined,
  jobort: string | null | undefined,
  jobland?: string | null,
  /**
   * Die Koordinaten der Stelle, wenn sie an ihr stehen.
   *
   * ── Warum das den Unterschied macht ─────────────────────────
   *
   * Ohne sie wird der Ortsname bei jedem Aufruf aufgelöst — beim ersten
   * Mal über einen fremden Dienst, danach aus `geo_orte`. Bei
   * zehntausenden verschiedenen Orten trifft der erste Fall ständig
   * jemanden, und die Seite wartet dann auf Nominatim.
   *
   * `scripts/koordinaten-nachtragen.mjs` schreibt sie an die Stellen.
   * Ohne diesen Weg hierher wäre das eine gefüllte Spalte, die niemand
   * liest — und genau dieser Fehler steckt an mehreren Stellen dieses
   * Projekts.
   */
  jobKoordinate?: { lat: number | null; lon: number | null } | null,
): Promise<Arbeitswegbefund> {
  if (!wohnort) {
    return { strecken: [], grund: "kein_wohnort" };
  }

  const fertig: Koordinate | null =
    jobKoordinate && jobKoordinate.lat !== null && jobKoordinate.lon !== null
      ? /* Der Anzeigename bleibt der Ortsname aus der Anzeige: Die
           Koordinate an der Stelle trägt keinen, und ein erfundener
           wäre schlechter als der, den der Arbeitgeber geschrieben hat. */
        { lat: jobKoordinate.lat, lon: jobKoordinate.lon, name: jobort ?? undefined }
      : null;

  /*
   * Ein gescheiterter Dienst ist ein unbekannter Ort, kein Absturz.
   *
   * `ortAufloesen` fragt beim ersten Mal einen fremden Dienst. Fällt
   * der aus, warf diese Funktion — und wer sie im Renderpfad aufruft,
   * riss die ganze Seite mit.
   *
   * Auf der eigenen Stellenseite betraf das eine Stelle. Seit der
   * Arbeitsweg auch in der rechten Spalte der Liste steht, hätte
   * derselbe Ausfall die Trefferliste erwischt — also die Seite, auf
   * der jemand gerade sucht.
   *
   * Es gibt bereits eine Sprache für „weiss ich nicht":
   * `wohnort_unbekannt` und `jobort_unbekannt`. Ein Ausfall gehört
   * dorthin. Der Unterschied für den Menschen ist gering — er sieht
   * keine Fahrzeit —, der Unterschied für die Seite ist alles.
   */
  const [von, nach] = await Promise.all([
    ortAufloesen(wohnort).catch((e) => {
      console.error("[geo] Wohnort nicht auflösbar:", e);
      return null;
    }),
    fertig
      ? Promise.resolve(fertig)
      : ortAufloesen(jobort, jobland).catch((e) => {
          console.error("[geo] Jobort nicht auflösbar:", e);
          return null;
        }),
  ]);

  if (!von) return { strecken: [], grund: "wohnort_unbekannt" };
  if (!nach) return { strecken: [], grund: "jobort_unbekannt" };

  /*
   * Drei Anfragen parallel.
   *
   * Nacheinander wären es bis zu drei Zeitüberschreitungen
   * hintereinander — bei einem langsamen Dienst also 24 Sekunden, bevor
   * die Seite fertig ist. Parallel ist es eine.
   */
  /*
   * Nur die Verkehrsmittel, die der Dienst wirklich kann.
   *
   * Der öffentliche OSRM antwortet auf jedes Profil mit der Autoroute.
   * Rad und Fuss anzufragen ergäbe dreimal dieselbe Zahl unter drei
   * verschiedenen Überschriften — und „Fahrrad: 64 Minuten" für achtzig
   * Kilometer sähe aus wie eine Auskunft.
   */
  const ergebnisse = await Promise.all(
    verfuegbareModi().map((m) => streckeMitCache(von, nach, m)),
  );

  const strecken = ergebnisse.filter((s): s is Wegstrecke => s !== null);

  return {
    strecken,
    grund: strecken.length === 0 ? "kein_weg" : null,
    zielname: nach.name,
  };
}
