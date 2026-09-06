"use server";

import { getDb, schema, withSystem } from "@paycheck/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ARBEITSDIMENSIONEN, type Arbeitsdimension } from "@paycheck/domain";
import { requireUser } from "@/lib/auth";
import { verlangeRolle } from "@/lib/arbeitgeber/zugang";

/**
 * Die Role Truth Card ausfüllen — als Arbeitgeber.
 *
 * ── Warum das freiwillig ist und trotzdem wirkt ───────────────
 *
 * Niemand wird gezwungen, „warum Menschen diese Position verlassen"
 * auszufüllen. Wer es tut, sagt etwas über sich — und wer das Feld
 * leer lässt, ebenfalls. Auf der Stellenseite steht deshalb
 * ausdrücklich, ob eine Karte vom Arbeitgeber stammt oder nur aus dem
 * Anzeigentext gelesen wurde.
 *
 * ── Was ein Arbeitgeber hier NICHT kann ───────────────────────
 *
 * Seine Passung verbessern. Diese Angaben beschreiben die Rolle; sie
 * gehen in den Vergleich mit dem Career Twin ein und können eine
 * Stelle für jemanden genauso gut unpassender machen. Wer „viel Druck"
 * angibt, verliert die Menschen, die keinen wollen — und findet die,
 * die ihn suchen.
 */

/**
 * Nur wer die Stelle verwaltet, darf ihre Karte ändern.
 *
 * Die Organisation wird aus der Stelle gelesen und dann geprüft — nicht
 * aus dem Formular übernommen. Sonst könnte jemand eine fremde
 * Stellenkennung senden und die Rollenbeschreibung eines anderen
 * Unternehmens umschreiben.
 */
async function darfBearbeiten(postingId: string): Promise<boolean> {
  const db = await getDb();
  const [p] = await withSystem(db, (tx) =>
    tx
      .select({ orgId: schema.jobPostings.organizationId })
      .from(schema.jobPostings)
      .where(eq(schema.jobPostings.id, postingId))
      .limit(1),
  );
  if (!p) return false;
  return await verlangeRolle(p.orgId, "recruiter")
    .then(() => true)
    .catch(() => false);
}

export async function rollenachsenSpeichern(
  postingId: string,
  werte: Record<string, { wert: number; begruendung: string }>,
): Promise<void> {
  if (!(await darfBearbeiten(postingId))) throw new Error("Kein Zugriff auf diese Stelle.");
  const db = await getDb();

  for (const [d, v] of Object.entries(werte)) {
    if (!ARBEITSDIMENSIONEN.includes(d as Arbeitsdimension)) continue;
    if (!Number.isFinite(v.wert)) continue;
    await withSystem(db, (tx) =>
      tx
        .insert(schema.rollenAussagen)
        .values({
          postingId,
          dimension: d,
          wert: Math.min(1, Math.max(0, v.wert)),
          begruendung: (v.begruendung ?? "").trim().slice(0, 400),
        })
        .onConflictDoUpdate({
          target: [schema.rollenAussagen.postingId, schema.rollenAussagen.dimension],
          set: {
            wert: Math.min(1, Math.max(0, v.wert)),
            begruendung: (v.begruendung ?? "").trim().slice(0, 400),
          },
        }),
    );
  }
  revalidatePath(`/business/stellen/${postingId}`);
}

export async function aufgabenSpeichern(
  postingId: string,
  aufgaben: { aufgabe: string; zeitanteil: number }[],
): Promise<void> {
  if (!(await darfBearbeiten(postingId))) throw new Error("Kein Zugriff auf diese Stelle.");
  const db = await getDb();

  /*
   * Ersetzen statt ergänzen — hier ist es richtig.
   *
   * Anders als beim Career Twin ist das keine Sammlung von Aussagen
   * über die Zeit, sondern eine aktuelle Aufteilung. Wer sie ändert,
   * korrigiert sie; die alte Fassung ist damit falsch, nicht älter.
   */
  await withSystem(db, (tx) =>
    tx.delete(schema.rollenAufgaben).where(eq(schema.rollenAufgaben.postingId, postingId)),
  );

  const sauber = aufgaben
    .map((a, i) => ({
      postingId,
      aufgabe: a.aufgabe.trim().slice(0, 200),
      zeitanteil: Math.min(100, Math.max(0, Math.round(a.zeitanteil))),
      reihenfolge: i,
    }))
    .filter((a) => a.aufgabe.length > 0 && a.zeitanteil > 0);

  if (sauber.length > 0) {
    await withSystem(db, (tx) => tx.insert(schema.rollenAufgaben).values(sauber));
  }
  revalidatePath(`/business/stellen/${postingId}`);
}

export async function abgaengeSpeichern(postingId: string, gruende: string[]): Promise<void> {
  if (!(await darfBearbeiten(postingId))) throw new Error("Kein Zugriff auf diese Stelle.");
  const db = await getDb();
  await withSystem(db, (tx) =>
    tx.delete(schema.rollenAbgaenge).where(eq(schema.rollenAbgaenge.postingId, postingId)),
  );
  const sauber = gruende
    .map((g, i) => ({ postingId, grund: g.trim().slice(0, 300), reihenfolge: i }))
    .filter((g) => g.grund.length > 0);
  if (sauber.length > 0) {
    await withSystem(db, (tx) => tx.insert(schema.rollenAbgaenge).values(sauber));
  }
  revalidatePath(`/business/stellen/${postingId}`);
}

/**
 * Eine Rollenangabe als Mitarbeiter bestätigen oder ihr widersprechen.
 *
 * Der eigene Wert, nicht ein Ja/Nein: Wer widerspricht, sagt damit
 * auch, wie es stattdessen ist. Erst ab drei Stimmen erscheint es auf
 * der Stellenseite, und dort nie mit Namen.
 */
export async function rolleBestaetigen(
  postingId: string,
  dimension: string,
  wert: number,
  kommentar = "",
): Promise<void> {
  const user = await requireUser();
  if (!ARBEITSDIMENSIONEN.includes(dimension as Arbeitsdimension)) return;
  const db = await getDb();
  await withSystem(db, (tx) =>
    tx
      .insert(schema.rollenBestaetigungen)
      .values({
        postingId,
        userId: user.id,
        dimension,
        wert: Math.min(1, Math.max(0, wert)),
        kommentar: kommentar.trim().slice(0, 500),
      })
      .onConflictDoUpdate({
        target: [
          schema.rollenBestaetigungen.postingId,
          schema.rollenBestaetigungen.userId,
          schema.rollenBestaetigungen.dimension,
        ],
        set: { wert: Math.min(1, Math.max(0, wert)), kommentar: kommentar.trim().slice(0, 500) },
      }),
  );
}
