import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Stellen eines Vorhabens
 * ══════════════════════════════════════════════════════════════════
 *
 * Ein Projekt hat zwei Arten von Stellen, und sie kommen aus zwei
 * verschiedenen Richtungen:
 *
 *   aus der Suche  — der Suchauftrag des Projekts hat sie gefunden,
 *                    bewertet und in `auftrag_treffer` abgelegt
 *   von Hand       — jemand hat eine gemerkte Stelle hineingelegt
 *
 * Beide gehören in dieselbe Liste, aber nicht ununterscheidbar: Eine
 * Stelle, die Monday gefunden hat, trägt einen Fit und Gründe; eine,
 * die jemand selbst hineingelegt hat, trägt beides nicht. Sie als
 * gleichwertig zu zeigen hiesse zu behaupten, für die zweite sei
 * dieselbe Prüfung gelaufen.
 *
 * ── Warum die Zahlen nicht hier gerechnet werden ────────────────
 *
 * Weil sie schon gerechnet sind. `auftragslaufRunde` prüft die
 * Kriterien, ruft `stelleBewerten` und schreibt das Ergebnis samt
 * Zulässigkeit und Begründungen weg. Hier noch einmal zu rechnen
 * wäre eine zweite Gewichtung neben der bestehenden — genau das,
 * wovor die Bewertung selbst warnt.
 *
 * ── Warum nach `kanonische_job_id` entdoppelt wird ──────────────
 *
 * Dieselbe Stelle steht auf mehreren Portalen und erzeugt deshalb
 * mehrere Treffer. Untereinander gelistet sieht das aus wie drei
 * offene Stellen bei derselben Firma.
 */

export type Herkunft = "suche" | "hand";

export interface Projektstelle {
  /** Die Zeile in `saved_jobs`, falls von Hand zugeordnet — sonst null. */
  merkId: string | null;
  jobId: string;
  titel: string;
  firma: string;
  /** `null`, wenn das Profil für eine Zahl zu dünn war. */
  fit: number | null;
  /** eligible · ineligible · needs_clarification — nur bei `suche`. */
  zulaessigkeit: string | null;
  /** Was für die Stelle spricht. Aus dem Lauf, nicht aus dieser Datei. */
  gruende: string[];
  herkunft: Herkunft;
}

/**
 * Wie viele Treffer je Vorhaben höchstens gelesen werden.
 *
 * Die Liste unter einem Projekt ist eine Übersicht, keine Suche. Wer
 * alle sehen will, geht auf die Stellenseite — dort gibt es Filter,
 * Sortierung und Nachladen.
 */
export const TREFFERGRENZE = 40;

/**
 * Die Stellen eines Vorhabens, aus beiden Richtungen.
 *
 * Wirft nicht: Ein Vorhaben ohne Suchauftrag ist der Normalfall,
 * solange keiner angelegt wurde, und liefert dann nur die von Hand
 * zugeordneten.
 */
export async function projektStellen(
  userId: string,
  projektId: string,
  grenze: number = TREFFERGRENZE,
): Promise<Projektstelle[]> {
  const db = await getDb();

  return withUser(db, userId, async (tx) => {
    /*
     * Die Treffer der Suchaufträge dieses Vorhabens.
     *
     * `ausgeschlossen` bleibt draussen: Der Lauf hat entschieden,
     * dass die Stelle nicht passt, und sie trotzdem zu zeigen würde
     * diese Entscheidung rückgängig machen, ohne sie zu widerlegen.
     *
     * `zurueckgestellt` bleibt drin — das heisst „noch nicht
     * empfohlen", nicht „passt nicht", und die Zulässigkeit steht
     * daneben.
     */
    const ausSuche = await tx
      .selectDistinctOn([schema.auftragTreffer.kanonischeJobId], {
        jobId: schema.auftragTreffer.jobId,
        kanonisch: schema.auftragTreffer.kanonischeJobId,
        titel: schema.jobs.title,
        firma: schema.companies.name,
        fit: schema.auftragTreffer.fitScore,
        zulaessigkeit: schema.auftragTreffer.zulaessigkeit,
        gruende: schema.auftragTreffer.gruende,
        berechnetAm: schema.auftragTreffer.berechnetAm,
      })
      .from(schema.auftragTreffer)
      .innerJoin(
        schema.suchAuftraege,
        eq(schema.suchAuftraege.id, schema.auftragTreffer.auftragId),
      )
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.auftragTreffer.jobId))
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(
        and(
          eq(schema.auftragTreffer.userId, userId),
          eq(schema.suchAuftraege.projektId, projektId),
          ne(schema.auftragTreffer.empfehlungsstatus, "ausgeschlossen"),
          inArray(schema.auftragTreffer.zustand, ["offen", "ausgewaehlt", "benachrichtigt"]),
        ),
      )
      /* `distinctOn` verlangt, dass die erste Sortierung die
         Entdopplungsspalte ist. Welche der doppelten Zeilen bleibt,
         entscheidet der Rest: die zuletzt gerechnete. */
      .orderBy(
        schema.auftragTreffer.kanonischeJobId,
        desc(schema.auftragTreffer.berechnetAm),
      )
      .limit(grenze);

    /* Von Hand zugeordnet. Ohne Fit und ohne Gründe — für diese
       Stellen ist keine Prüfung gelaufen. */
    const vonHand = await tx
      .select({
        merkId: schema.savedJobs.id,
        jobId: schema.jobs.id,
        titel: schema.jobs.title,
        firma: schema.companies.name,
      })
      .from(schema.savedJobs)
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.savedJobs.jobId))
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(and(eq(schema.savedJobs.userId, userId), eq(schema.savedJobs.projektId, projektId)))
      .limit(grenze);

    /*
     * Zusammenführen, ohne dieselbe Stelle zweimal.
     *
     * Wer eine Stelle merkt, die die Suche ohnehin gefunden hat, soll
     * sie einmal sehen — und dann mit Fit, weil die Prüfung für sie
     * gelaufen ist. Der Handeintrag liefert in diesem Fall nur noch
     * die Merkkennung, damit sich die Zuordnung wieder lösen lässt.
     */
    const merkeNachJob = new Map(vonHand.map((v) => [v.jobId, v.merkId]));

    const gefunden: Projektstelle[] = ausSuche.map((t) => ({
      merkId: merkeNachJob.get(t.jobId) ?? null,
      jobId: t.jobId,
      titel: t.titel,
      firma: t.firma,
      fit: t.fit,
      zulaessigkeit: t.zulaessigkeit,
      gruende: t.gruende,
      herkunft: "suche" as const,
    }));

    const bekannt = new Set(gefunden.map((g) => g.jobId));
    const eigene: Projektstelle[] = vonHand
      .filter((v) => !bekannt.has(v.jobId))
      .map((v) => ({
        merkId: v.merkId,
        jobId: v.jobId,
        titel: v.titel,
        firma: v.firma,
        fit: null,
        zulaessigkeit: null,
        gruende: [],
        herkunft: "hand" as const,
      }));

    /*
     * Gefundene zuerst, nach Fit. Ein fehlender Fit steht hinten und
     * nicht als Null vorne — „keine Zahl" ist nicht „Null Punkte".
     */
    gefunden.sort((a, b) => (b.fit ?? -1) - (a.fit ?? -1));
    return [...gefunden, ...eigene].slice(0, grenze);
  });
}

/**
 * Wie viele Stellen an einem Vorhaben hängen — für die Seitenleiste.
 *
 * Eine eigene, schmale Abfrage statt `projektStellen(...).length`:
 * Die Leiste steht auf jeder Seite und braucht Titel, Firmen und
 * Gründe nicht, um eine Zahl zu zeigen.
 */
export async function projektStellenZahl(
  userId: string,
  projektIds: string[],
): Promise<Map<string, number>> {
  if (projektIds.length === 0) return new Map();
  const db = await getDb();

  return withUser(db, userId, async (tx) => {
    const zeilen = await tx
      .select({
        projektId: schema.suchAuftraege.projektId,
        /* Entdoppelt gezählt, sonst zählt dieselbe Stelle auf drei
           Portalen als drei. */
        anzahl: sql<number>`count(distinct ${schema.auftragTreffer.kanonischeJobId})::int`,
      })
      .from(schema.auftragTreffer)
      .innerJoin(
        schema.suchAuftraege,
        eq(schema.suchAuftraege.id, schema.auftragTreffer.auftragId),
      )
      .where(
        and(
          eq(schema.auftragTreffer.userId, userId),
          inArray(schema.suchAuftraege.projektId, projektIds),
          ne(schema.auftragTreffer.empfehlungsstatus, "ausgeschlossen"),
          inArray(schema.auftragTreffer.zustand, ["offen", "ausgewaehlt", "benachrichtigt"]),
        ),
      )
      .groupBy(schema.suchAuftraege.projektId);

    const karte = new Map<string, number>();
    for (const z of zeilen) if (z.projektId) karte.set(z.projektId, z.anzahl);
    return karte;
  });
}
