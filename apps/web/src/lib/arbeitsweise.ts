"use server";

import { and, eq, like, or } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  BELEGART,
  DIMENSIONEN,
  KENNUNG,
  VORSATZ,
  eintragPruefen,
  type Ausgeschlossen,
  type Dimension,
} from "@paycheck/domain";

/**
 * ══════════════════════════════════════════════════════════════════
 * Das Arbeitsweise-Profil speichern und lesen
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Warum in `evidence_items` und nicht in einer eigenen Tabelle ─
 *
 * Weil der Passungswert dort liest. `profilkontext.ts` holt
 * `workStylePreferences`, `rankedValues` und die Energie-Listen über
 * `source_ref like '%…%'` aus genau dieser Tabelle. Eine eigene
 * Tabelle daneben wäre ein zweiter Ort für dieselbe Sache — und der
 * Passungswert bliebe leer, während die Oberfläche ein volles Profil
 * zeigt.
 *
 * Am 10.09.2026 gemessen: mittlere Abdeckung 0,12 über 561 Treffer.
 * Genau diese Lücke wird hier gefüllt.
 *
 * ── Warum nichts gelöscht wird ──────────────────────────────────
 *
 * Wer eine Aussage zurücknimmt, setzt `user_rejected`. Der Leser
 * überspringt sie, sie zählt in keiner Rechnung mehr — aber es bleibt
 * nachvollziehbar, dass sie einmal dastand und zurückgenommen wurde.
 * Das ist der Unterschied zwischen einem Profil, das jemandem gehört,
 * und einem, das sich still verändert.
 */

export interface Aussage {
  id: string;
  text: string;
}

export interface Dimensionsstand {
  dimension: Dimension;
  aussagen: Aussage[];
}

/** Der Vorsatz, an dem der Leser die Richtung erkennt. */
function vorsatz(d: Dimension): string {
  if (d === "energie") return VORSATZ.gibt;
  if (d === "schwerpunkte") return VORSATZ.kostet;
  return "";
}

/** Für die Anzeige wieder abziehen — der Mensch hat ihn nicht geschrieben. */
function ohneVorsatz(text: string): string {
  for (const v of [VORSATZ.gibt, VORSATZ.kostet]) {
    if (text.startsWith(v)) return text.slice(v.length);
  }
  return text;
}

export async function arbeitsweiseLaden(): Promise<Dimensionsstand[]> {
  const user = await requireUser();
  const db = await getDb();

  const zeilen = await withUser(db, user.id, (tx) =>
    tx
      .select({
        id: schema.evidenceItems.id,
        statement: schema.evidenceItems.statement,
        sourceRef: schema.evidenceItems.sourceRef,
      })
      .from(schema.evidenceItems)
      .where(
        and(
          eq(schema.evidenceItems.userId, user.id),
          eq(schema.evidenceItems.userRejected, false),
          or(
            like(schema.evidenceItems.sourceRef, `%${KENNUNG.energie}%`),
            like(schema.evidenceItems.sourceRef, `%${KENNUNG.arbeitsstil}%`),
            like(schema.evidenceItems.sourceRef, `%${KENNUNG.haltegruende}%`),
            like(schema.evidenceItems.sourceRef, `%${KENNUNG.lernrichtung}%`),
          ),
        ),
      ),
  ).catch(() => []);

  return DIMENSIONEN.map((d) => ({
    dimension: d,
    aussagen: zeilen
      .filter((z) => {
        if (!z.sourceRef?.includes(KENNUNG[d])) return false;
        /*
         * `energie` und `schwerpunkte` teilen sich eine Kennung — sie
         * sind zwei Richtungen derselben Frage. Getrennt werden sie
         * über den Vorsatz, den auch der Leser benutzt.
         */
        if (d === "energie") return z.statement.startsWith(VORSATZ.gibt);
        if (d === "schwerpunkte") return z.statement.startsWith(VORSATZ.kostet);
        return true;
      })
      .map((z) => ({ id: z.id, text: ohneVorsatz(z.statement) })),
  }));
}

export type Speicherlage =
  | { art: "gespeichert"; anzahl: number; ausgeschlossen: Ausgeschlossen[] }
  | { art: "zu_duenn"; hinweis: string; ausgeschlossen: Ausgeschlossen[] };

/**
 * Eine Dimension ergänzen.
 *
 * Geprüft wird vor dem Schreiben: geschützte Merkmale, Leerformeln,
 * zu Kurzes. Was nicht durchkommt, wird gemeldet statt still
 * verschluckt.
 */
export async function dimensionSpeichern(
  dimension: Dimension,
  roh: string,
): Promise<Speicherlage> {
  const user = await requireUser();

  /* Eine Zeile ist eine Aussage. Ein Absatz mit fünf Gedanken auch. */
  const aussagen = roh
    .split(/\r?\n/)
    .map((z) => z.trim())
    .filter(Boolean);

  const lage = eintragPruefen(aussagen);
  if (lage.art === "zu_duenn") {
    return { art: "zu_duenn", hinweis: lage.hinweis, ausgeschlossen: lage.ausgeschlossen };
  }

  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx.insert(schema.evidenceItems).values(
      lage.aussagen.map((a) => ({
        userId: user.id,
        type: BELEGART[dimension],
        statement: vorsatz(dimension) + a,
        /*
         * `user_stated`, nicht `user_confirmed`.
         *
         * Der Mensch hat es gesagt — das ist etwas anderes, als dass
         * es jemand geprüft hätte. Die Unterscheidung steht im
         * Datenmodell und soll dort auch stimmen.
         */
        sourceType: "user_stated" as const,
        sourceRef: KENNUNG[dimension],
        userConfirmed: true,
      })),
    ),
  );

  revalidatePath("/app/arbeitsweise");
  return { art: "gespeichert", anzahl: lage.aussagen.length, ausgeschlossen: lage.ausgeschlossen };
}

/**
 * Eine Aussage zurücknehmen.
 *
 * Nicht löschen: Der Leser überspringt zurückgenommene Belege, und es
 * bleibt sichtbar, dass etwas dastand.
 */
export async function aussageZuruecknehmen(id: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.evidenceItems)
      .set({ userRejected: true })
      .where(and(eq(schema.evidenceItems.id, id), eq(schema.evidenceItems.userId, user.id))),
  ).catch((e) => console.error("[arbeitsweise] nicht zurückgenommen:", e));
  revalidatePath("/app/arbeitsweise");
}
