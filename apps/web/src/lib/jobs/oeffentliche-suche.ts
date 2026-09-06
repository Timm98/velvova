import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";

/**
 * Die Stellensuche für Besucher ohne Konto.
 *
 * ── Warum nicht `listJobsForUser` ─────────────────────────────
 *
 * Die angemeldete Suche bewertet jede Anzeige gegen ein Profil. Ohne
 * Konto gibt es kein Profil, und eine Bewertung gegen ein leeres
 * Profil wäre keine neutrale Reihenfolge, sondern eine zufällige.
 * Hier wird deshalb nur gefiltert und nach Datum sortiert — was ein
 * Besucher auch erwartet.
 *
 * ── Warum Wortvektoren und kein `ilike` ───────────────────────
 *
 * Gemessen an 2,4 Mio. Zeilen: `title ilike '%…%'` braucht 30 s,
 * `location ilike '%…%'` 27 s. Beides ist keine langsame Seite,
 * sondern gar keine. Die Indizes stehen in Migration 0061.
 *
 * Beim Ort kommt Richtigkeit dazu: `%Berlin%` findet „Überlingen"
 * mit, ein Präfix `Berlin%` verliert „Wedding, Berlin". Nur die
 * Wortsuche trifft beides richtig.
 */

/** Wie viele Treffer je Seite. */
export const PRO_SEITE = 24;

/*
 * Ab hier wird nicht weiter gezählt.
 *
 * `count(*)` über alle Treffer kostet bei häufigen Orten Sekunden —
 * für Berlin gemessen 5,9 s. Die genaue Zahl interessiert niemanden;
 * „über 1.000" sagt dasselbe und ist sofort da. Gezählt wird deshalb
 * nur bis zur Schranke.
 */
const ZAEHLGRENZE = 1000;

export type Suchparameter = {
  q?: string;
  ort?: string;
  land?: string;
  seite?: number;
};

export type Suchtreffer = {
  id: string;
  titel: string;
  unternehmen: string;
  ort: string;
  land: string;
  gehaltMin: number | null;
  gehaltMax: number | null;
  waehrung: string;
  gehaltZeitraum: string | null;
  gehaltAngegeben: boolean;
  arbeitsmodell: string | null;
  quelle: string;
  veroeffentlicht: string | null;
};

export type Suchergebnis = {
  treffer: Suchtreffer[];
  /** Gezählt bis {@link ZAEHLGRENZE}. */
  anzahl: number;
  /** Wahr, wenn die Schranke erreicht wurde — dann ist `anzahl` eine Untergrenze. */
  mehrAls: boolean;
  seite: number;
  hatWeitere: boolean;
};

function bedingungen(p: Suchparameter): SQL[] {
  const teile: SQL[] = [eq(schema.jobs.isDemo, false)];

  const q = p.q?.trim();
  if (q) {
    teile.push(
      sql`to_tsvector('german', ${schema.jobs.title}) @@ plainto_tsquery('german', ${q})`,
    );
  }

  const ort = p.ort?.trim();
  if (ort) {
    teile.push(
      sql`to_tsvector('simple', ${schema.jobs.location}) @@ plainto_tsquery('simple', ${ort})`,
    );
  }

  const land = p.land?.trim().toUpperCase();
  if (land && /^[A-Z]{2}$/.test(land)) {
    teile.push(eq(schema.jobs.country, land));
  }

  return teile;
}

export async function oeffentlicheSuche(p: Suchparameter): Promise<Suchergebnis> {
  const db = await getDb();
  const seite = Math.max(1, Math.floor(p.seite ?? 1));
  const wo = and(...bedingungen(p));

  /*
   * Erst die Filter auflösen, dann sortieren — in dieser Reihenfolge,
   * und zwar erzwungen.
   *
   * Sobald ein Index auf `published_at` existiert, hält der Planer es
   * für schlau, ihn der Reihe nach zu lesen und die Nicht-Treffer
   * wegzuwerfen. Bei einem seltenen Suchwort geht das schief:
   * gemessen für „Softwareentwickler" 58.527 verworfene Zeilen,
   * 33.424 von der Platte gelesene Blöcke, 17 Sekunden. Über den
   * Wortindex sind es 48 Millisekunden.
   *
   * `as materialized` verbietet ihm das Zusammenlegen: die Treffer
   * werden erst über den GIN-Index gesammelt, dann sortiert. Gemessen
   * über vier verschieden häufige Suchwörter ist dieser Weg nie
   * langsamer und im schlechtesten Fall 128-mal schneller:
   *
   *   Softwareentwickler   1.895 Treffer   6.143 ms →  48 ms
   *   Pflegefachkraft     19.091 Treffer     408 ms →  88 ms
   *   Mitarbeiter         38.394 Treffer     141 ms → 135 ms
   *   Verkäufer           46.225 Treffer     177 ms → 153 ms
   *
   * Ohne Wort- und Ortsfilter gilt das nicht: dann gibt es nichts
   * vorzufiltern, und der Datumsindex ist genau richtig (142 ms für
   * die neuesten Anzeigen aus 2,4 Mio.). Deshalb die Fallunterscheidung.
   *
   * Eine Zeile mehr als angezeigt wird, um zu wissen, ob eine weitere
   * Seite folgt, ohne dafür ein zweites Mal zu suchen.
   */
  const vorfiltern = Boolean(p.q?.trim() || p.ort?.trim());
  const spalten = sql`id, title, company_id, source_id, location, country,
      salary_min, salary_max, salary_currency, salary_period, salary_disclosed,
      work_model, published_at`;
  const menge = PRO_SEITE + 1;
  const versatz = (seite - 1) * PRO_SEITE;

  const abfrage = vorfiltern
    ? sql`with treffer as materialized (
            select ${spalten} from ${schema.jobs} where ${wo}
          )
          select * from treffer
          order by published_at desc nulls last
          limit ${menge} offset ${versatz}`
    : sql`select ${spalten} from ${schema.jobs} where ${wo}
          order by published_at desc nulls last
          limit ${menge} offset ${versatz}`;

  type Zeile = {
    id: string; title: string; company_id: string; source_id: string;
    location: string; country: string;
    salary_min: number | null; salary_max: number | null;
    salary_currency: string; salary_period: string | null;
    salary_disclosed: boolean; work_model: string | null;
    published_at: Date | string | null;
  };
  const ergebnis = (await db.execute(abfrage).catch(() => ({ rows: [] }))) as { rows: Zeile[] };
  const zeilen = ergebnis.rows ?? [];

  const hatWeitere = zeilen.length > PRO_SEITE;
  const sichtbar = zeilen.slice(0, PRO_SEITE);

  const firmaIds = [...new Set(sichtbar.map((z) => z.company_id))];
  const quelleIds = [...new Set(sichtbar.map((z) => z.source_id))];

  const [firmen, quellen] = await Promise.all([
    firmaIds.length
      ? db
          .select({ id: schema.companies.id, name: schema.companies.name })
          .from(schema.companies)
          .where(inArray(schema.companies.id, firmaIds))
          .catch(() => [])
      : Promise.resolve([]),
    quelleIds.length
      ? db
          .select({ id: schema.jobSources.id, name: schema.jobSources.displayName })
          .from(schema.jobSources)
          .where(inArray(schema.jobSources.id, quelleIds))
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const firmaName = new Map(firmen.map((f) => [f.id, f.name]));
  const quelleName = new Map(quellen.map((q) => [q.id, q.name]));

  const treffer: Suchtreffer[] = sichtbar.map((z) => ({
    id: z.id,
    titel: z.title,
    /* Fehlt der Name, steht das da — nicht ein leeres Feld, das wie
       ein Darstellungsfehler aussieht. */
    unternehmen: firmaName.get(z.company_id) ?? "Unternehmen nicht angegeben",
    ort: z.location,
    land: z.country,
    gehaltMin: z.salary_min,
    gehaltMax: z.salary_max,
    waehrung: z.salary_currency,
    gehaltZeitraum: z.salary_period,
    gehaltAngegeben: z.salary_disclosed,
    arbeitsmodell: z.work_model,
    quelle: quelleName.get(z.source_id) ?? "unbekannte Quelle",
    veroeffentlicht: z.published_at ? new Date(z.published_at).toISOString() : null,
  }));

  /* Gezählt wird in einer eigenen Abfrage, gedeckelt — siehe ZAEHLGRENZE.
     Gemessen 141 ms, weil der Planer nach 1.000 Zeilen aufhört. */
  const gezaehlt = (await db
    .execute(
      sql`select count(*)::int n from (
            select 1 from ${schema.jobs}
            where ${wo}
            limit ${ZAEHLGRENZE}
          ) t`,
    )
    .catch(() => ({ rows: [{ n: 0 }] }))) as { rows: { n: number }[] };
  const anzahl = Number(gezaehlt.rows?.[0]?.n ?? 0);

  return { treffer, anzahl, mehrAls: anzahl >= ZAEHLGRENZE, seite, hatWeitere };
}
