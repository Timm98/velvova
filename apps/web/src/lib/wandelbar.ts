import { getDb, schema, withUser } from "@paycheck/db";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import {
  fragenZusammenstellen,
  hindernisse,
  lageText,
  lohntAnfrage,
  type Anfragelage,
  type Kriterienbefund,
} from "@paycheck/domain";

/**
 * ══════════════════════════════════════════════════════════════════
 * Stellen, an denen nur eine Bedingung im Weg steht
 * ══════════════════════════════════════════════════════════════════
 *
 * Der Abgleich wirft sie weg. Zu Recht: Ein verletztes
 * Muss-Kriterium ist ein verletztes Muss-Kriterium, und eine Stelle
 * mit 40 Stunden passt nicht zu jemandem, der 32 arbeiten kann.
 *
 * Nur ist die Anzeige keine Tatsache, sondern eine Momentaufnahme
 * dessen, was sich jemand vorgestellt hat. Und niemand fragt nach.
 *
 * ── Warum das nichts neu rechnet ────────────────────────────────
 *
 * `auftrag_treffer.kriterien_ergebnisse` hält je Stelle fest, welches
 * Kriterium woran gescheitert ist — mit Begründung und Beleg aus der
 * Anzeige. Diese Datei liest das und ordnet zu. Eine zweite Prüfung
 * daneben käme irgendwann zu einem anderen Ergebnis als die Liste,
 * aus der sie stammt.
 *
 * ── Warum eine Schwelle beim Fit ────────────────────────────────
 *
 * Ohne sie stünde hier jede Stelle, die irgendein Kriterium verletzt
 * — Tausende. „Fast passend" heisst: Alles andere stimmt schon.
 */

/** Darunter ist es keine fast passende Stelle, sondern eine andere. */
export const FIT_SCHWELLE = 70;

export interface FastPassend {
  jobId: string;
  titel: string;
  firma: string;
  ort: string | null;
  fitScore: number | null;
  lage: Anfragelage;
  /** Was der Mensch dazu liest. */
  text: string;
  /** Die Fragen, die an den Arbeitgeber gehen könnten. Leer heisst: keine. */
  fragen: string[];
}

/**
 * Die Stellen, an denen sich eine Frage lohnen würde.
 *
 * Nur solche, bei denen ALLE Hindernisse Bedingungen des Arbeitgebers
 * sind. Wo eine Zulassung fehlt oder die eigene Pendelgrenze im Weg
 * steht, wird hier nichts angeboten — die erste Frage wäre eine
 * Aufforderung zum Rechtsbruch, die zweite eine Entscheidung, die
 * niemand ausser dem Menschen selbst treffen kann.
 */
export async function fastPassende(userId: string, grenze = 3): Promise<FastPassend[]> {
  const db = await getDb();

  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .select({
        jobId: schema.auftragTreffer.jobId,
        titel: schema.jobs.title,
        firma: schema.companies.name,
        ort: schema.jobs.location,
        fitScore: schema.auftragTreffer.fitScore,
        ergebnisse: schema.auftragTreffer.kriterienErgebnisse,
      })
      .from(schema.auftragTreffer)
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.auftragTreffer.jobId))
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(
        and(
          eq(schema.auftragTreffer.userId, userId),
          /*
           * Genau die, die der Abgleich weggeworfen hat. `eligible`
           * steht schon in der Liste oben, `needs_clarification` ist
           * eine fehlende Angabe und keine Bedingung.
           */
          eq(schema.auftragTreffer.zulaessigkeit, "ineligible"),
          gte(schema.auftragTreffer.fitScore, FIT_SCHWELLE),
          inArray(schema.auftragTreffer.zustand, ["offen", "ausgewaehlt", "benachrichtigt"]),
        ),
      )
      .orderBy(desc(schema.auftragTreffer.fitScore))
      /* Mehr laden als nötig: Die meisten fallen gleich wieder raus. */
      .limit(grenze * 8),
  ).catch(() => []);

  const treffer: FastPassend[] = [];
  for (const z of zeilen) {
    const lage = lohntAnfrage(hindernisse((z.ergebnisse ?? []) as Kriterienbefund[]));
    if (lage.art !== "lohnt") continue;
    const fragen = fragenZusammenstellen(lage);
    /*
     * Eine Anfrage ohne Frage ist keine.
     *
     * Das passiert, wenn das einzige Hindernis das Gehalt ist — dafür
     * gibt es bewusst keinen Fragetext. Die Stelle hier trotzdem zu
     * zeigen hiesse, einen Weg anzubieten, den es nicht gibt.
     */
    if (fragen.length === 0) continue;
    treffer.push({ ...z, lage, text: lageText(lage), fragen });
    if (treffer.length >= grenze) break;
  }
  return treffer;
}
