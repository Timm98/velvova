import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import type { Arbeitgeberart, Arbeitgeberprofil, FrühereStelle, Suchprofil } from "@paycheck/domain";

/**
 * ══════════════════════════════════════════════════════════════════
 * Woher die stille Chance ihre Eingaben bekommt
 * ══════════════════════════════════════════════════════════════════
 *
 * `chancePruefen` erwartet zwei fertige Angaben — einen Arbeitgeber
 * und ein Suchprofil — und weiss nicht, woher sie kommen. Diese Datei
 * holt sie aus der Datenbank.
 *
 * ── Warum das Berufsfeld die KldB ist und kein freier Text ──────
 *
 * Weil beide Seiten sie bereits führen: `jobs.kldb` trägt die
 * amtliche Berufskennung der Anzeige, `role_clusters.kldb_codes` die
 * der bestätigten Rollen eines Menschen. Ein eigener Textvergleich
 * daneben wäre eine zweite Taxonomie, die mit der ersten irgendwann
 * auseinanderläuft.
 *
 * Verglichen wird auf der Hauptgruppe — den ersten zwei Ziffern.
 * `71304` und `71399` sind verschiedene Tätigkeiten in derselben
 * Berufshauptgruppe, und für die Frage „beschäftigt dieser
 * Arbeitgeber Menschen wie dich" ist die Gruppe die richtige Ebene.
 * Auf voller Länge fände man fast nie einen Treffer.
 *
 * ── Was hier NICHT passiert ─────────────────────────────────────
 *
 * Kein Abruf, keine Bewertung, keine Entscheidung. Diese Datei liest.
 */

/** Die ersten zwei Ziffern. `null`, wenn keine Kennung dasteht. */
export function hauptgruppe(kldb: string | null | undefined): string | null {
  const k = kldb?.trim();
  return k && k.length >= 2 ? k.slice(0, 2) : null;
}

/**
 * Wie viele frühere Anzeigen je Arbeitgeber gelesen werden.
 *
 * Genug, um ein Muster zu sehen, und wenig genug, dass ein
 * Grossarbeitgeber mit zehntausend Anzeigen den Lauf nicht sprengt.
 * Die Bewertung deckelt den Mengenanteil ohnehin bei drei Treffern.
 */
const STELLEN_JE_ARBEITGEBER = 40;

/**
 * Arbeitgeberprofile für eine Menge von Firmen laden.
 *
 * In zwei Abfragen statt in einer je Firma: Bei fünfzig Arbeitgebern
 * wären das hundert Netzrunden gegen Supabase, und die kosten mehr als
 * die Auswertung danach.
 */
export async function arbeitgeberprofile(
  firmenIds: readonly string[],
): Promise<Map<string, Arbeitgeberprofil>> {
  if (firmenIds.length === 0) return new Map();
  const db = await getDb();

  const firmen = await db
    .select({
      id: schema.companies.id,
      name: schema.companies.name,
      industry: schema.companies.industry,
      headquarters: schema.companies.headquarters,
    })
    .from(schema.companies)
    .where(inArray(schema.companies.id, [...firmenIds]));

  /*
   * Die Anzeigen aller Firmen in einem Zug.
   *
   * Zwei Datumsangaben, und der Unterschied zählt: `publishedAt` ist
   * die Angabe des ARBEITGEBERS, `fetchedAt` unsere. Für die Frage
   * „wann hat dieser Arbeitgeber zuletzt so jemanden gesucht" ist
   * seine Angabe die richtige — unsere sagt nur, wann wir hingesehen
   * haben.
   *
   * `publishedAt` darf leer sein; viele Quellen liefern es nicht.
   * Dann gilt unsere, und das ist die schwächere, aber ehrliche
   * Auskunft.
   */
  const anzeigen = await db
    .select({
      companyId: schema.jobs.companyId,
      id: schema.jobs.id,
      title: schema.jobs.title,
      location: schema.jobs.location,
      kldb: schema.jobs.kldb,
      publishedAt: schema.jobs.publishedAt,
      fetchedAt: schema.jobs.fetchedAt,
    })
    .from(schema.jobs)
    .where(
      and(
        inArray(schema.jobs.companyId, [...firmenIds]),
        eq(schema.jobs.isDemo, false),
      ),
    )
    .orderBy(desc(schema.jobs.fetchedAt))
    .limit(firmenIds.length * STELLEN_JE_ARBEITGEBER);

  const jeFirma = new Map<string, FrühereStelle[]>();
  for (const a of anzeigen) {
    const liste = jeFirma.get(a.companyId) ?? [];
    if (liste.length >= STELLEN_JE_ARBEITGEBER) continue;
    liste.push({
      titel: a.title,
      berufsfeld: hauptgruppe(a.kldb),
      ort: a.location,
      gesehenAm: a.publishedAt ?? a.fetchedAt,
      /* Die Fundstelle ist unsere eigene Kennung — sie führt zur Anzeige. */
      quelle: `job:${a.id}`,
    });
    jeFirma.set(a.companyId, liste);
  }

  return new Map(
    firmen.map((f) => [
      f.id,
      {
        name: f.name,
        art: arbeitgeberartRaten(f.name, f.industry),
        branche: f.industry,
        ort: f.headquarters,
        frühereStellen: jeFirma.get(f.id) ?? [],
      },
    ]),
  );
}

/**
 * Öffentlich oder privat?
 *
 * ── Warum das geraten wird und warum das hier vertretbar ist ────
 *
 * Es gibt keine Spalte dafür. Die Alternative wäre, alle Arbeitgeber
 * als privat zu führen — und das hätte eine Folge, die genau in die
 * falsche Richtung geht: Ein Landratsamt bekäme eine
 * Initiativbewerbung statt einer Anfrage nach geplanten
 * Ausschreibungen.
 *
 * Die Vermutung ist deshalb bewusst grosszügig. Wer fälschlich als
 * öffentlich gilt, bekommt eine vorsichtigere Nachricht als nötig.
 * Wer fälschlich als privat gilt, bekommt die falsche.
 */
const OEFFENTLICHE_WOERTER = [
  "landratsamt", "landkreis", "kreisverwaltung", "stadtverwaltung",
  "gemeinde", "stadt ", "kommunal", "bezirksamt", "regierungspräsidium",
  "ministerium", "behörde", "amt für", "bundesagentur", "bundesanstalt",
  "hochschule", "universität", "fachhochschule", "studierendenwerk",
  "klinikum", "universitätsklinik", "landesamt", "zweckverband",
  "anstalt des öffentlichen rechts", "körperschaft des öffentlichen rechts",
  "eigenbetrieb", "stadtwerke", "kreissparkasse", "sparkasse",
  /*
   * Aus `companies.industry`, nicht aus dem Namen.
   *
   * "verwaltung" allein steht auch in Hausverwaltung und
   * Vermögensverwaltung — beides privat. Nur mit dem Zusatz ist es
   * eindeutig.
   */
  "öffentliche verwaltung", "oeffentliche verwaltung",
  "öffentlicher dienst", "oeffentlicher dienst",
];

export function arbeitgeberartRaten(
  name: string,
  branche: string | null,
): Arbeitgeberart {
  const text = `${name} ${branche ?? ""}`.toLowerCase();
  return OEFFENTLICHE_WOERTER.some((w) => text.includes(w)) ? "oeffentlich" : "privat";
}

/**
 * Das Suchprofil eines Menschen.
 *
 * Es kommt aus dem, was er BESTÄTIGT hat, und nicht aus dem, was
 * Monday über ihn vermutet: `role_clusters` nur mit
 * `user_confirmed`, `preferences` nur mit `bestaetigt`.
 *
 * ── Warum das der entscheidende Filter ist ──────────────────────
 *
 * Aus sieben Ablehnungen darf kein Filter werden, den niemand
 * gesetzt hat — der Kommentar an `preferences.bestaetigt` sagt das
 * bereits, und hier ist die Stelle, an der es zählt: Auf Grundlage
 * einer Vermutung würden Arbeitgeber angeschrieben.
 *
 * Gibt `null` zurück, wenn zu wenig bestätigt ist. Ein Suchprofil
 * ohne Berufsfeld ist kein Suchprofil, und eine Chance darauf zu
 * gründen hiesse, aus dem Nichts einen Vorschlag zu machen.
 */
export async function suchprofilLaden(userId: string): Promise<Suchprofil | null> {
  const db = await getDb();

  const [rollen, vorlieben, einstellungen] = await Promise.all([
    withUser(db, userId, (tx) =>
      tx
        .select({ kldbCodes: schema.roleClusters.kldbCodes })
        .from(schema.roleClusters)
        .where(
          and(
            eq(schema.roleClusters.userId, userId),
            eq(schema.roleClusters.userConfirmed, true),
          ),
        ),
    ),
    withUser(db, userId, (tx) =>
      tx
        .select({
          kind: schema.preferences.kind,
          value: schema.preferences.value,
          hart: schema.preferences.harteBedingung,
        })
        .from(schema.preferences)
        .where(
          and(
            eq(schema.preferences.userId, userId),
            eq(schema.preferences.bestaetigt, true),
          ),
        ),
    ),
    withUser(db, userId, async (tx) =>
      (
        await tx
          .select({ land: schema.userSettings.jobMarketCountry })
          .from(schema.userSettings)
          .where(eq(schema.userSettings.userId, userId))
          .limit(1)
      )[0],
    ),
  ]);

  const berufsfelder = [
    ...new Set(
      rollen
        .flatMap((r) => r.kldbCodes)
        .map(hauptgruppe)
        .filter((k): k is string => k !== null),
    ),
  ];

  if (berufsfelder.length === 0) return null;

  const werte = (art: string) =>
    vorlieben.filter((v) => v.kind === art).map((v) => v.value);

  return {
    berufsfelder,
    orte: werte("ort"),
    branchen: werte("branche"),
    bevorzugteArt: null,
    /*
     * Ausschlüsse nur aus HARTEN Bedingungen.
     *
     * Eine weiche Vorliebe senkt den Wert, eine harte schliesst aus —
     * so steht es an `preferences.harteBedingung`, und hier gilt
     * dasselbe. Eine weiche Abneigung gegen Behörden zum Ausschluss
     * zu machen wäre eine Verschärfung, die niemand angeordnet hat.
     */
    ausgeschlosseneArten: vorlieben
      .filter((v) => v.hart && v.kind === "arbeitgeberart_ausschluss")
      .map((v) => (v.value === "oeffentlich" ? "oeffentlich" : "privat")),
    ausgeschlosseneNamen: vorlieben
      .filter((v) => v.hart && v.kind === "arbeitgeber_ausschluss")
      .map((v) => v.value),
  } satisfies Suchprofil & { _land?: typeof einstellungen };
}

/**
 * Arbeitgeber, die für eine stille Chance überhaupt infrage kommen.
 *
 * Nur solche, von denen wir mindestens eine Anzeige im passenden
 * Berufsfeld kennen — das ist die Grundlage der ganzen Bewertung.
 * Wer noch nie mit einer passenden Anzeige aufgefallen ist, über den
 * wissen wir nichts, und `arbeitgeberpassung` gäbe ohnehin
 * „nicht bewertbar" zurück.
 *
 * Ausgenommen sind Firmen mit einer AKTUELLEN passenden Anzeige: Für
 * die gibt es einen Weg, der besser ist als jede Anfrage.
 */
export async function firmenMitPassendenAnzeigen(
  berufsfelder: readonly string[],
  grenze = 50,
): Promise<{ id: string; aktuellAusgeschrieben: boolean }[]> {
  if (berufsfelder.length === 0) return [];
  const db = await getDb();

  const zeilen = await db
    .select({
      id: schema.jobs.companyId,
      /*
       * Zählt eine Anzeige als aktuell?
       *
       * `availability_state` steht seit Migration 0101 an der Stelle
       * und ist die Auskunft der Quelle, nicht unsere Vermutung.
       */
      aktuell: sql<boolean>`bool_or(${schema.jobs.availabilityState} = 'active')`,
    })
    .from(schema.jobs)
    .where(
      and(
        isNotNull(schema.jobs.kldb),
        inArray(sql`left(${schema.jobs.kldb}, 2)`, [...berufsfelder]),
        eq(schema.jobs.isDemo, false),
      ),
    )
    .groupBy(schema.jobs.companyId)
    .limit(grenze);

  return zeilen.map((z) => ({ id: z.id, aktuellAusgeschrieben: Boolean(z.aktuell) }));
}
