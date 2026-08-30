import { and, count, eq, isNull, ne, or, sql } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
import { loadRuntimeConfig } from "@paycheck/config";
import { sourceStatuses } from "@paycheck/jobs";

/**
 * Was wirklich durchsucht wurde.
 *
 * Die Zahl „23 Stellen" sagt nichts darüber, ob 23 von 30 oder 23 von
 * 30.000 übrig blieben. Und „das ganze Internet" wäre eine Behauptung,
 * die genau eine aktive Quelle nicht deckt.
 *
 * Jede Zahl hier ist gezählt, keine geschätzt. Ist nur eine Quelle
 * aktiv, steht „1 Quelle durchsucht" — nicht mehr.
 */

export interface Quellenabdeckung {
  /** Wie viele Quellen tatsächlich abgefragt wurden. */
  aktiveQuellen: number;
  /** Namen der aktiven Quellen, für die Aufzählung. */
  aktiveNamen: string[];
  /** Wie viele Quellen es gäbe, wenn alles eingerichtet wäre. */
  möglicheQuellen: number;
  /** Alle Anzeigen, die je eingesammelt wurden. */
  rohTreffer: number;
  /** Nach Entdopplung über den Inhaltshash. */
  eindeutig: number;
  /** Davon aktiv: kein toter Link, nicht abgelaufen. */
  aktiv: number;
  /** Wann zuletzt abgerufen wurde. */
  zuletzt: Date | null;
  /** Je Quelle für die Detailansicht. */
  jeQuelle: {
    key: string;
    name: string;
    aktiv: boolean;
    grund: string;
    anzahl: number;
    zuletzt: Date | null;
  }[];
}

/** Zu Datum machen, was als Text ankommt. Ungültiges wird `null`, nicht NaN. */
function alsDatum(wert: string | null | undefined): Date | null {
  if (!wert) return null;
  const d = new Date(wert);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function ladeQuellenabdeckung(): Promise<Quellenabdeckung> {
  const db = await getDb();
  const cfg = loadRuntimeConfig();
  const status = sourceStatuses(cfg);

  /*
   * Eine Abfrage für alle Kennzahlen.
   *
   * Fünf einzelne `count(*)` wären fünf Tabellendurchläufe. Bei
   * tausend Zeilen ist das egal; bei hunderttausend nicht, und dann
   * schreibt es niemand mehr um.
   */
  const [gesamt] = await db
    .select({
      roh: count(),
      eindeutig: sql<number>`count(distinct ${schema.jobs.contentHash})::int`,
      aktiv: sql<number>`count(*) filter (
        where ${schema.jobs.isDemo} = false
          and (${schema.jobs.expiresAt} is null or ${schema.jobs.expiresAt} > now())
          and (${schema.jobs.lastLinkCheckOk} is null or ${schema.jobs.lastLinkCheckOk} = true)
      )::int`,
      /*
       * Als Zeichenkette abholen und selbst umwandeln.
       *
       * Drizzle liefert einen rohen `max(...)` als Text zurück, nicht
       * als Date — der Treiber kennt den Typ des Ausdrucks nicht. Ein
       * `Intl.DateTimeFormat().format()` darauf wirft „Invalid time
       * value", und zwar erst beim Rendern: die ganze Seite blieb leer.
       */
      zuletzt: sql<string | null>`max(${schema.jobs.fetchedAt})::text`,
    })
    .from(schema.jobs);

  const proQuelle = await db
    .select({
      key: schema.jobSources.key,
      name: schema.jobSources.displayName,
      anzahl: count(schema.jobs.id),
      /*
       * Als Zeichenkette abholen und selbst umwandeln.
       *
       * Drizzle liefert einen rohen `max(...)` als Text zurück, nicht
       * als Date — der Treiber kennt den Typ des Ausdrucks nicht. Ein
       * `Intl.DateTimeFormat().format()` darauf wirft „Invalid time
       * value", und zwar erst beim Rendern: die ganze Seite blieb leer.
       */
      zuletzt: sql<string | null>`max(${schema.jobs.fetchedAt})::text`,
    })
    .from(schema.jobSources)
    .leftJoin(schema.jobs, eq(schema.jobs.sourceId, schema.jobSources.id))
    .groupBy(schema.jobSources.key, schema.jobSources.displayName);

  const zahlJeKey = new Map(proQuelle.map((r) => [r.key, r]));

  const jeQuelle = status
    .filter((s) => s.key !== "seed")
    .map((s) => {
      const zeile = zahlJeKey.get(s.key);
      return {
        key: s.key,
        name: s.displayName,
        aktiv: s.active,
        grund: s.reason,
        anzahl: zeile?.anzahl ?? 0,
        zuletzt: alsDatum(zeile?.zuletzt),
      };
    })
    // Aktive zuerst, danach nach Anzahl. Was nicht läuft, steht unten.
    .sort((a, b) => Number(b.aktiv) - Number(a.aktiv) || b.anzahl - a.anzahl);

  const aktive = jeQuelle.filter((q) => q.aktiv);

  return {
    aktiveQuellen: aktive.length,
    aktiveNamen: aktive.map((q) => q.name),
    möglicheQuellen: jeQuelle.length,
    rohTreffer: gesamt?.roh ?? 0,
    eindeutig: gesamt?.eindeutig ?? 0,
    aktiv: gesamt?.aktiv ?? 0,
    zuletzt: alsDatum(gesamt?.zuletzt),
    jeQuelle,
  };
}

/**
 * Der Satz über der Jobliste.
 *
 * Bewusst ohne Superlative und ohne „das ganze Internet". Bei einer
 * Quelle steht „1 Quelle" — der Plural allein wäre schon eine
 * Übertreibung.
 */
export function abdeckungssatz(
  a: Quellenabdeckung,
  passend: number,
): string {
  const quellen = a.aktiveQuellen === 1 ? "1 Quelle" : `${a.aktiveQuellen} Quellen`;
  const teile = [
    `${quellen} durchsucht`,
    `${a.rohTreffer.toLocaleString("de-DE")} Roh-Treffer`,
    `${a.aktiv.toLocaleString("de-DE")} aktive Stellen`,
    `${passend.toLocaleString("de-DE")} erfüllen deine Bedingungen`,
  ];
  return teile.join(" · ");
}
