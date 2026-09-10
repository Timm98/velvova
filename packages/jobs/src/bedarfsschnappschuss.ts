import { sql } from "drizzle-orm";
import { getDb, withSystem } from "@paycheck/db";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Uhr, die man nicht nachstellen kann
 * ══════════════════════════════════════════════════════════════════
 *
 * Einmal am Tag festhalten, welcher Arbeitgeber welchen Beruf an
 * welchem Ort ausgeschrieben hat. Mehr nicht.
 *
 * ── Warum das dringend ist ──────────────────────────────────────
 *
 * Am 10.09.2026 gemessen: Velvovas eigene Beobachtung
 * (`job_source_links`) reichte elf Tage zurück. Das `published_at` der
 * Anzeigen reicht zwölf Monate, kommt aber aus dem Feed des Anbieters
 * — es sagt, wann der Arbeitgeber veröffentlicht hat, nicht, ob eine
 * Stelle inzwischen besetzt war und NEU ausgeschrieben wurde.
 *
 * Genau das ist aber die Frage, an der echter Bedarf hängt. Und sie
 * lässt sich nur beantworten, wenn jemand von heute an mitschreibt:
 * Jeder Tag ohne Aufzeichnung ist ein Tag Historie, die es nie geben
 * wird.
 *
 * ── Warum der Ort in den Schlüssel gehört ───────────────────────
 *
 * Ohne ihn ist ein Filialnetz nicht von Dauerbedarf zu unterscheiden.
 * An der Spitze der Messung standen Netto mit 9.140 Anzeigen für
 * Verkauf und Lidl mit 7.317 — jede in einer anderen Filiale. Die
 * Einstufung in `dauerbedarf.ts` hängt an dieser Trennung.
 *
 * ── Warum eine einzige Anweisung ────────────────────────────────
 *
 * Der Lauf geht über rund 1,2 Millionen aktive deutsche Anzeigen. Sie
 * einzeln zu laden und in Node zu zählen hiesse, sie durch die
 * Verbindung zu schleifen; die Datenbank kann dasselbe an Ort und
 * Stelle. Zweimal am selben Tag zu laufen schadet nicht — der
 * Primärschlüssel enthält den Tag, und ein zweiter Lauf schreibt
 * dieselbe Zahl.
 */

export interface Schnappschussbericht {
  tag: string;
  zeilen: number;
  dauerMs: number;
}

export async function schnappschussNehmen(
  tag = new Date(),
): Promise<Schnappschussbericht> {
  const begonnen = Date.now();
  const datum = tag.toISOString().slice(0, 10);
  const db = await getDb();

  const ergebnis = (await withSystem(db, (tx) =>
    tx.execute(sql`
      insert into bedarfs_schnappschuss (tag, company_id, beruf, ort, stellen)
      select
        ${datum}::date,
        j.company_id,
        left(j.kldb, 4),
        /*
         * "Berlin, Mitte" und "berlin " sind derselbe Ort. Ohne diese
         * Normalisierung zerfiele ein Arbeitgeber in Dutzende Orte und
         * jede Reihe hätte die Länge eins.
         */
        lower(btrim(split_part(j.location, ',', 1))),
        count(*)::int
      from jobs j
      where j.is_demo = false
        and j.country = 'DE'
        and j.kldb is not null
        and j.location <> ''
        and (j.expires_at is null or j.expires_at > now())
      group by 1, 2, 3, 4
      on conflict (tag, company_id, beruf, ort) do update
        set stellen = excluded.stellen
      returning 1`),
  )) as unknown as { rows: unknown[] };

  return {
    tag: datum,
    zeilen: ergebnis.rows.length,
    dauerMs: Date.now() - begonnen,
  };
}

/**
 * Was der Schnappschuss über ein Paar hergibt.
 *
 * ── Warum die Lücken hier gezählt werden und nicht im Modell ────
 *
 * „Wie oft riss die Reihe ab" ist eine Fensterfunktion über sortierte
 * Tage. Ein Sprachmodell, dem man dieselbe Frage stellt, rät — und
 * rät bei 9.140 Anzeigen „offensichtlich hoher Bedarf". Die Zahl
 * gehört dorthin, wo sie nachrechenbar ist.
 */
export interface Reihe {
  companyId: string;
  arbeitgeber: string;
  beruf: string;
  ort: string;
  beobachtungTage: number;
  tageMitAnzeige: number;
  luecken: number;
  orteDesArbeitgebers: number;
}

export async function reihenLesen(grenze = 200): Promise<Reihe[]> {
  const db = await getDb();
  const ergebnis = (await withSystem(db, (tx) =>
    tx.execute(sql`
      with spanne as (
        select (max(tag) - min(tag) + 1)::int as tage from bedarfs_schnappschuss
      ),
      /* Ein Abriss ist ein Tag mit Anzeige, dem ein Tag OHNE vorausging. */
      folge as (
        select company_id, beruf, ort, tag,
               lag(tag) over (partition by company_id, beruf, ort order by tag) as vorher
        from bedarfs_schnappschuss
      ),
      reihe as (
        select company_id, beruf, ort,
               count(*)::int as tage_mit_anzeige,
               count(*) filter (where vorher is not null and tag - vorher > 1)::int as luecken
        from folge group by 1, 2, 3
      ),
      orte as (
        select company_id, beruf, count(distinct ort)::int as orte
        from bedarfs_schnappschuss group by 1, 2
      )
      select r.company_id as "companyId", c.name as arbeitgeber, r.beruf, r.ort,
             (select tage from spanne) as "beobachtungTage",
             r.tage_mit_anzeige as "tageMitAnzeige",
             r.luecken,
             o.orte as "orteDesArbeitgebers"
      from reihe r
      join orte o on o.company_id = r.company_id and o.beruf = r.beruf
      join companies c on c.id = r.company_id
      order by r.luecken desc, r.tage_mit_anzeige desc
      limit ${grenze}`),
  )) as unknown as { rows: Reihe[] };
  return ergebnis.rows;
}
