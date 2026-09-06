import { and, count, eq, gt, isNull, sql } from "drizzle-orm";
import { schema, withUser, type Database } from "@paycheck/db";

/**
 * Was ausser neuen Belegen noch dafür spricht, neu zu rechnen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Ereignis nicht sofort das Modell ruft
 * ══════════════════════════════════════════════════════════════
 *
 * Weil ein Lebenslauf-Upload selten allein kommt. Die Person lädt
 * die Datei hoch, korrigiert eine Angabe, sieht sich drei Stellen an
 * und schreibt Nina eine Nachricht — alles in zehn Minuten. Wer bei
 * jedem dieser Schritte eine Synthese anstösst, bezahlt fünfmal das
 * tiefe Modell für fünf Bilder, die sich kaum unterscheiden.
 *
 * Ein Anstoss SENKT deshalb die Schwelle, statt sie zu umgehen. Aus
 * „fünf neue Belege" wird „zwei neue Belege" — die zehn Minuten
 * Wartezeit gelten weiter, und in diesen zehn Minuten sammelt sich,
 * was zusammengehört.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es keine eigene Tabelle dafür gibt
 * ══════════════════════════════════════════════════════════════
 *
 * Weil alle diese Ereignisse bereits irgendwo stehen: Dokumente in
 * `user_documents`, Bewerbungen in `applications`, Klicks in
 * `nutzer_ereignisse`. Eine Markierungstabelle daneben wäre eine
 * zweite Wahrheit über dasselbe Geschehen — und die erste, die
 * veraltet, wenn jemand vergisst, sie zu schreiben.
 *
 * Das ist der Fehler, der in diesem Projekt am häufigsten vorkommt:
 * eine Tabelle, die ein Verhalten beschreibt, das kein Code umsetzt.
 */

export type Anstossart =
  | "lebenslauf"
  | "bewerbung"
  | "suche_geaendert"
  | "viel_angesehen";

export interface Anstoss {
  art: Anstossart;
  /** In der Sprache der Person — steht später im Protokoll. */
  was: string;
}

/**
 * Ab wie vielen eigenen Stellenaufrufen das als Anstoss zählt.
 *
 * Drei, weil ein einzelner Klick nichts sagt und zwei ein Zufall
 * sein können. Dieselbe Zahl wie bei den Gegenbelegen eines
 * Widerspruchs — aus demselben Grund.
 */
export const ANGESEHEN_AB = 3;

/**
 * Was sich seit einem Zeitpunkt getan hat, das kein Beleg ist.
 *
 * ── Warum `seit` von aussen kommt ─────────────────────────────
 *
 * Weil der richtige Zeitpunkt die letzte Synthese ist, und die kennt
 * nur der Aufrufer. Ein festes Fenster („letzte 24 Stunden") würde
 * bei einem Profil, das seit einer Woche nicht gerechnet wurde,
 * genau die Ereignisse übersehen, die den Rückstand erklären.
 */
export async function anstoesse(
  db: Database,
  userId: string,
  seit: Date,
): Promise<Anstoss[]> {
  return withUser(db, userId, async (tx) => {
    const raus: Anstoss[] = [];

    const [dok] = await tx
      .select({ n: count() })
      .from(schema.userDocuments)
      .where(
        and(
          eq(schema.userDocuments.userId, userId),
          isNull(schema.userDocuments.deletedAt),
          /*
           * `updatedAt`, nicht `createdAt`.
           *
           * Eine erneut hochgeladene oder neu ausgewertete Datei ist
           * derselbe Anstoss wie eine neue: Was Nina über den Menschen
           * weiss, hat sich geändert.
           */
          gt(schema.userDocuments.updatedAt, seit),
        ),
      );
    if ((dok?.n ?? 0) > 0) raus.push({ art: "lebenslauf", was: "neue oder geänderte Unterlagen" });

    const [bew] = await tx
      .select({ n: count() })
      .from(schema.applications)
      .where(and(eq(schema.applications.userId, userId), gt(schema.applications.createdAt, seit)));
    if ((bew?.n ?? 0) > 0) raus.push({ art: "bewerbung", was: "eine neue Bewerbung" });

    /*
     * Nur `user`.
     *
     * Was Nina selbst getan hat, ist kein Anstoss, über Nina neu
     * nachzudenken. Sonst entstünde derselbe Kreis, den `urheber` in
     * den Verhaltenssignalen verhindert: Nina merkt vor, das gilt als
     * Aktivität, Nina rechnet neu, merkt wieder vor.
     */
    const zeilen = await tx
      .select({ art: schema.nutzerEreignisse.art, n: count() })
      .from(schema.nutzerEreignisse)
      .where(
        and(
          eq(schema.nutzerEreignisse.userId, userId),
          eq(schema.nutzerEreignisse.urheber, "user"),
          gt(schema.nutzerEreignisse.geschehenAm, seit),
        ),
      )
      .groupBy(schema.nutzerEreignisse.art);

    const je = new Map(zeilen.map((z) => [z.art, Number(z.n)]));

    if ((je.get("search_changed") ?? 0) + (je.get("filter_changed") ?? 0) > 0)
      raus.push({ art: "suche_geaendert", was: "eine geänderte Suche" });

    const angesehen =
      (je.get("job_viewed") ?? 0) + (je.get("job_reopened") ?? 0) + (je.get("job_saved") ?? 0);
    if (angesehen >= ANGESEHEN_AB)
      raus.push({ art: "viel_angesehen", was: `${angesehen} angesehene Stellen` });

    if ((je.get("apply_started") ?? 0) > 0 && !raus.some((a) => a.art === "bewerbung"))
      raus.push({ art: "bewerbung", was: "eine begonnene Bewerbung" });

    return raus;
  });
}
