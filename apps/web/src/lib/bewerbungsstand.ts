"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { recordEvent } from "@/lib/matching";

/**
 * ══════════════════════════════════════════════════════════════════
 * „Hast du die Bewerbung abgeschickt?" — und was mit der Antwort
 * geschieht
 * ══════════════════════════════════════════════════════════════════
 *
 * Wer über Velvova zu einer Stellenanzeige geht, bewirbt sich dort
 * selbst. Was danach passiert, weiss das Produkt nicht — ein Redirect
 * sagt nichts darüber, ob jemand ein Formular ausgefüllt hat.
 *
 * Deshalb wird gefragt. Und die Antwort muss irgendwo hin.
 *
 * ── Was hier vorher stand ───────────────────────────────────────
 *
 * `HandoffConfirm.tsx` hielt die Antwort in `useState` und schrieb sie
 * nirgendwohin — `void jobId;` in Zeile 32. Auf jede Antwort erschien
 * „Notiert." Das war kein fehlendes Feature, sondern ein simulierter
 * Erfolgszustand: Das Produkt behauptete, etwas festgehalten zu haben,
 * und tat es nicht.
 *
 * Sichtbar wurde es nirgends. Die Bewerbung blieb in „In Vorbereitung"
 * stehen, und wer später auf seine Liste sah, hielt sich selbst für
 * vergesslich.
 *
 * ── Warum „noch nicht" genauso zählt wie „ja" ───────────────────
 *
 * Ohne diese Möglichkeit wäre die Frage eine Aufforderung. Und eine
 * Bewerbung, die jemand doch nicht abgeschickt hat, als gesendet zu
 * führen, ist schlimmer als sie gar nicht zu führen: Es entstünde eine
 * Erwartung auf eine Antwort, die nie kommt.
 */

export type Stand = "sent" | "not_yet" | "aborted" | "later";

export type Standbefund =
  | { ok: true; stand: Stand; applicationId: string | null }
  | { ok: false; grund: "stelle_unbekannt" | "fehler" };

/**
 * Den selbst gemeldeten Stand einer Bewerbung festhalten.
 *
 * `sent` ist die einzige Antwort, die den Stand der Bewerbung ändert —
 * und sie ändert ihn auf genau das, was der Mensch gesagt hat, nicht
 * mehr. „Abgeschickt" heisst nicht „angekommen" und nicht
 * „gelesen".
 */
export async function bewerbungsstandMelden(
  jobId: string,
  stand: Stand,
): Promise<Standbefund> {
  const user = await requireUser();

  try {
    const db = await getDb();

    const applicationId = await withUser(db, user.id, async (tx) => {
      const [vorhanden] = await tx
        .select({ id: schema.applications.id, stage: schema.applications.stage })
        .from(schema.applications)
        .where(and(eq(schema.applications.userId, user.id), eq(schema.applications.jobId, jobId)))
        .limit(1);

      if (stand !== "sent") {
        /*
         * Kein Eintrag für „noch nicht".
         *
         * Wer sagt, er habe es nicht abgeschickt, hat nichts getan,
         * was festzuhalten wäre. Eine Zeile anzulegen hiesse, aus
         * einer Absicht einen Vorgang zu machen.
         */
        return vorhanden?.id ?? null;
      }

      if (vorhanden) {
        await tx
          .update(schema.applications)
          .set({ stage: "sent", lastContactAt: new Date(), updatedAt: new Date() })
          .where(eq(schema.applications.id, vorhanden.id));
        return vorhanden.id;
      }

      /*
       * Es gab noch keine Bewerbung.
       *
       * Der Weg über die Originalanzeige führt an der Vorbereitung
       * vorbei — wer dort direkt abschickt, hat nie eine Zeile
       * angelegt. Sie erst jetzt zu erzeugen ist richtig: Sie hat
       * stattgefunden, also gehört sie in die Liste.
       */
      const [neu] = await tx
        .insert(schema.applications)
        .values({ userId: user.id, jobId, stage: "sent", lastContactAt: new Date() })
        .returning({ id: schema.applications.id });
      return neu?.id ?? null;
    });

    if (stand === "sent" && applicationId) {
      /*
       * Der Ergebnisstrom.
       *
       * `recordEvent` ist die eine Stelle, durch die alles läuft: Sie
       * schreibt das Ereignis, friert die Vorhersage ein und vermerkt
       * den Ausgang. Ohne diesen Aufruf wäre die Bewerbung in der
       * Liste sichtbar und in jeder Auswertung unsichtbar — genau die
       * Lücke, die es bei den Velvova-internen Bewerbungen gibt.
       */
      await recordEvent(user.id, "application_sent", { jobId, applicationId });
    }

    revalidatePath("/app/applications");
    revalidatePath(`/app/jobs/${jobId}`);
    return { ok: true, stand, applicationId };
  } catch (fehler) {
    console.error(
      "[bewerbung] Stand konnte nicht festgehalten werden:",
      fehler instanceof Error ? fehler.message : String(fehler),
    );
    return { ok: false, grund: "fehler" };
  }
}
