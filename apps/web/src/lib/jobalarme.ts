"use server";

import { getDb, schema, withUser } from "@paycheck/db";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

/**
 * ══════════════════════════════════════════════════════════════
 * ABGELÖST — nichts ruft dieses Modul mehr auf
 * ══════════════════════════════════════════════════════════════
 *
 * Der Suchauftrag steht seit Migration 0082 in `such_auftraege` mit
 * einzelnen Kriterien (Stärke, Herkunft, Bestätigungsstand) und wird
 * von `scripts/suchauftrag-worker.mjs` tatsächlich abgearbeitet.
 * Siehe `packages/jobs/src/suchauftrag/` und
 * `apps/web/src/lib/suchauftrag/aktionen.ts`.
 *
 * Was hier fehlte, war nicht der Versand, sondern der Leser: Die
 * Zeilen in `job_alarme` hat nie ein Dienst angesehen. Der Filter als
 * Zeichenkette liess sich auch nicht prüfen — man sieht ihr nicht an,
 * ob „Teilzeit" ein Muss oder ein Wunsch war.
 *
 * Die Datei bleibt stehen, weil die Tabelle noch Zeilen echter
 * Menschen enthält. Sie neu zu verdrahten wäre ein Rückschritt.
 *
 * ──────────────────────────────────────────────────────────────
 *
 * Suchaufträge — gespeicherte Suchen, die benachrichtigen sollen.
 *
 * ── Warum kein Newsletter ─────────────────────────────────────
 *
 * „Newsletter abonnieren" mit einer Erfolgsmeldung, hinter der nichts
 * passiert, ist eine Lüge mit Häkchen. Hier wird eine Suche wirklich
 * gespeichert, mit den Filtern, die gerade gesetzt sind.
 *
 * Der Versand steht noch aus, und die Oberfläche sagt das auch. Ein
 * „Danke, du erhältst ab jetzt passende Stellen" wäre die bequeme
 * Formulierung — und beim ersten ausbleibenden Hinweis wüsste die
 * Person, dass ihr hier nichts zu glauben ist.
 */
export async function alarmSpeichern(
  name: string,
  filter: string,
  email?: string,
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const sauber = name.trim().slice(0, 120);
  if (sauber.length < 2) return { ok: false };

  /*
   * Eine Adresse, die keine ist, wird nicht gespeichert.
   *
   * Sie ist freiwillig: Ohne sie geht die Benachrichtigung an die
   * Adresse des Kontos. Etwas Unbrauchbares abzulegen wäre schlimmer
   * als nichts — es sähe später aus wie ein Zustellweg und wäre keiner.
   */
  const adresse =
    typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
      ? email.trim().toLowerCase().slice(0, 320)
      : null;

  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx.insert(schema.jobAlarme).values({
      userId: user.id,
      name: sauber,
      /* Die Filter in derselben Form wie in der Adresse — damit ist
         der Auftrag reproduzierbar. */
      filter: filter.slice(0, 2000),
      benachrichtigungEmail: adresse,
    }),
  );
  revalidatePath("/app/jobs");
  return { ok: true };
}

export interface Jobalarm {
  id: string;
  name: string;
  filter: string;
  aktiv: boolean;
  erstelltAm: Date;
}

export async function alarmeLaden(): Promise<Jobalarm[]> {
  const user = await requireUser();
  const db = await getDb();
  return withUser(db, user.id, (tx) =>
    tx
      .select({
        id: schema.jobAlarme.id,
        name: schema.jobAlarme.name,
        filter: schema.jobAlarme.filter,
        aktiv: schema.jobAlarme.aktiv,
        erstelltAm: schema.jobAlarme.erstelltAm,
      })
      .from(schema.jobAlarme)
      .where(eq(schema.jobAlarme.userId, user.id))
      .orderBy(desc(schema.jobAlarme.erstelltAm))
      .limit(20),
  ).catch(() => []);
}

export async function alarmLoeschen(id: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .delete(schema.jobAlarme)
      .where(and(eq(schema.jobAlarme.id, id), eq(schema.jobAlarme.userId, user.id))),
  );
  revalidatePath("/app/jobs");
}
