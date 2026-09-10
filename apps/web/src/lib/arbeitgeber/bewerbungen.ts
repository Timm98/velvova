"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { protokolliere, verlangeRolle } from "./zugang.ts";
import { STUFEN, type Stufe } from "./stufen.ts";

/**
 * Bewerbungen auf selbst eingestellte Stellen.
 *
 * ── Was ein Unternehmen sieht ─────────────────────────────────
 *
 * Genau die Felder von `posting_candidates` — Name, Kontakt, eine
 * Kurzbeschreibung, ein Anschreiben und die Dokumente, die die Person
 * für DIESE Bewerbung ausgewählt hat. Nichts wird über die
 * Nutzerkennung nachgeladen.
 *
 * Das ist eine Entscheidung im Schema und nicht im Abfragecode. Wer hier
 * versehentlich `select *` schreibt oder einen Join zu viel setzt,
 * bekommt trotzdem nichts Privates: In der Tabelle steht nichts
 * Privates. Der Gegenentwurf — eine Organisationskennung an
 * `applications` — hätte am selben Datensatz Notizen, Termine,
 * Coaching-Sitzungen und über `user_id` das ganze Profil hängen gehabt.
 *
 * ── Was ein Unternehmen NIE sieht ─────────────────────────────
 *
 * Den Monday-Chat, die Lebenshaltung, das aktuelle Gehalt, die
 * Steuerangaben, andere Bewerbungen, gespeicherte Stellen. Nicht als
 * Vereinbarung, sondern als Zeilensicherheit — geprüft in
 * `arbeitgeber-rls.test.ts` gegen eine echte Datenbank.
 */


/** Die Ordnung der Passungsbänder — bestes zuerst. */
const BANDRANG: Record<string, number> = { high: 0, medium: 1, exploratory: 2, insufficient: 3 };

export async function ladeBewerbungen(orgId: string, postingId?: string) {
  const user = await requireUser();
  const db = await getDb();
  const zeilen = await withUser(db, user.id, (tx) =>
    tx
      .select({
        /*
         * Die Felder einzeln, nicht die ganze Zeile.
         *
         * `candidate_user_id` bleibt bewusst draussen: Die Oberfläche
         * braucht sie nicht, und was nicht geladen wird, kann auch nicht
         * versehentlich in einer Ansicht landen oder als Schlüssel für
         * eine Nachfrage dienen.
         */
        id: schema.postingCandidates.id,
        postingId: schema.postingCandidates.postingId,
        displayName: schema.postingCandidates.displayName,
        contactEmail: schema.postingCandidates.contactEmail,
        headline: schema.postingCandidates.headline,
        coverNote: schema.postingCandidates.coverNote,
        sharedProfile: schema.postingCandidates.sharedProfile,
        stage: schema.postingCandidates.stage,
        employerNote: schema.postingCandidates.employerNote,
        rejectedReason: schema.postingCandidates.rejectedReason,
        withdrawnAt: schema.postingCandidates.withdrawnAt,
        createdAt: schema.postingCandidates.createdAt,
        stellentitel: schema.jobPostings.title,
      })
      .from(schema.postingCandidates)
      .innerJoin(
        schema.jobPostings,
        eq(schema.jobPostings.id, schema.postingCandidates.postingId),
      )
      .where(
        postingId
          ? and(
              eq(schema.postingCandidates.organizationId, orgId),
              eq(schema.postingCandidates.postingId, postingId),
            )
          : eq(schema.postingCandidates.organizationId, orgId),
      )
      .orderBy(desc(schema.postingCandidates.createdAt)),
  );

  /*
   * Nach geteilter Passung sortiert — nicht nach Eingang.
   *
   * ── Warum das der Sinn der Sache ist ──────────────────────
   *
   * Ein Arbeitgeber soll „nicht möglichst viele Bewerbungen, sondern
   * eine kleinere Zahl besser passender Kandidaten" bekommen. Ohne
   * Reihenfolge liest er von oben nach unten, und oben steht, wer
   * zuerst geklickt hat.
   *
   * ── Warum nur, wo geteilt wurde ───────────────────────────
   *
   * Das Band stammt aus dem privaten Profil des Menschen. Wer es nicht
   * ausdrücklich freigegeben hat, steht in der Reihenfolge weder vorn
   * noch hinten — er steht nach Eingang, wie bisher. Nicht zu teilen
   * darf keinen Nachteil bringen; sonst wäre die Einwilligung keine.
   *
   * Deshalb: geteilte zuerst nach Band, dann alle übrigen nach
   * Eingang. Ein Arbeitgeber sieht, wer etwas gesagt hat — nicht, wer
   * geschwiegen hat.
   */
  return [...zeilen].sort((a, b) => {
    const ba = (a.sharedProfile as { passungsband?: string })?.passungsband;
    const bb = (b.sharedProfile as { passungsband?: string })?.passungsband;
    if (ba && bb) return (BANDRANG[ba] ?? 9) - (BANDRANG[bb] ?? 9);
    if (ba) return -1;
    if (bb) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export async function stufeSetzen(
  orgId: string,
  bewerbungId: string,
  stufe: Stufe,
  grund?: string,
): Promise<{ ok: boolean; text: string }> {
  const { user } = await verlangeRolle(orgId, "recruiter");

  /*
   * Eine Absage braucht einen Grund.
   *
   * Nicht als Formalie: Eine Absage ohne Begründung ist die häufigste
   * und die am meisten kritisierte Erfahrung im Bewerbungsprozess. Wer
   * hier eine Zeile schreibt, kostet dreissig Sekunden und erspart
   * jemandem wochenlanges Rätselraten.
   *
   * Der Grund geht NICHT automatisch an die Person — was mitgeteilt
   * wird, entscheidet das Unternehmen. Er steht am Datensatz, damit die
   * Absage nachvollziehbar bleibt.
   */
  if (stufe === "rejected" && (!grund || grund.trim().length < 10)) {
    return {
      ok: false,
      text: "Für eine Absage brauche ich einen Grund — mindestens einen Satz.",
    };
  }

  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.postingCandidates)
      .set({
        stage: stufe,
        rejectedReason: stufe === "rejected" ? (grund?.trim() ?? null) : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.postingCandidates.id, bewerbungId),
          eq(schema.postingCandidates.organizationId, orgId),
        ),
      ),
  );
  await protokolliere(user.id, orgId, "bewerbung_stufe", bewerbungId, { stufe });
  revalidatePath("/business/bewerbungen");
  return { ok: true, text: `Auf „${STUFEN.find((s) => s.key === stufe)?.label}" gesetzt.` };
}

export async function notizSpeichern(
  orgId: string,
  bewerbungId: string,
  notiz: string,
): Promise<{ ok: boolean; text: string }> {
  const { user } = await verlangeRolle(orgId, "recruiter");
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.postingCandidates)
      .set({ employerNote: notiz.slice(0, 8000), updatedAt: new Date() })
      .where(
        and(
          eq(schema.postingCandidates.id, bewerbungId),
          eq(schema.postingCandidates.organizationId, orgId),
        ),
      ),
  );
  revalidatePath("/business/bewerbungen");
  return { ok: true, text: "Notiz gespeichert." };
}

// ── Die Bewerberseite ────────────────────────────────────────────

export interface Freigabe {
  displayName: string;
  contactEmail: string;
  headline?: string | null;
  coverNote?: string | null;
  /**
   * Was ausser Name, E-Mail und Anschreiben geteilt wird.
   *
   * ── Warum das nicht einfach der Passungswert ist ───────────
   *
   * Der Wert entsteht aus dem privaten Profil des Menschen — aus
   * Belegen, Bedingungen und dem Career Twin. Ihn ungefragt an einen
   * Arbeitgeber zu geben wäre eine Weitergabe seiner Daten, auch wenn
   * nur eine Zahl ankommt.
   *
   * Deshalb: ausdrücklich, und nur das Band, nie die Faktoren. Ein
   * Arbeitgeber erfährt „passt gut", nicht warum.
   */
  sharedProfile?: Record<string, unknown>;
  /** true nur, wenn die Person es angekreuzt hat. Voreinstellung ist nein. */
  passungTeilen?: boolean;
}

/**
 * Sich auf eine selbst eingestellte Stelle bewerben.
 *
 * ── Warum die Angaben kopiert und nicht verknüpft werden ──────
 *
 * Weil eine Freigabe einen Zeitpunkt hat. Wer sich im Januar mit einer
 * bestimmten Kurzbeschreibung bewirbt und sein Profil im März ändert,
 * hat nicht rückwirkend etwas anderes freigegeben. Eine Verknüpfung
 * würde dem Unternehmen im März den neuen Stand zeigen — Daten, die es
 * nie bekommen sollte.
 */
export async function bewerben(
  postingId: string,
  freigabe: Freigabe,
): Promise<{ ok: boolean; text: string }> {
  const user = await requireUser();
  const db = await getDb();

  /*
   * Nur auf veröffentlichte Stellen.
   *
   * Ein Entwurf ist für niemanden ausserhalb der Organisation sichtbar —
   * aber die Kennung stünde in einem Link, den jemand teilt. Ohne diese
   * Prüfung könnte man sich auf eine Stelle bewerben, die es noch nicht
   * gibt, und das Unternehmen fände eine Bewerbung auf einen Entwurf.
   *
   * Gelesen ohne Nutzerkontext, weil die Person kein Mitglied ist.
   * Herausgegeben wird nur, OB die Stelle veröffentlicht ist.
   */
  const [posting] = await db
    .select({
      id: schema.jobPostings.id,
      organizationId: schema.jobPostings.organizationId,
      status: schema.jobPostings.status,
      title: schema.jobPostings.title,
      /* Die Verknüpfung zur Stellentabelle. Nullbar — nicht jedes
         Velvova-Posting hat eine Entsprechung dort. */
      jobId: schema.jobPostings.jobId,
    })
    .from(schema.jobPostings)
    .where(eq(schema.jobPostings.id, postingId))
    .limit(1);

  if (!posting || posting.status !== "published") {
    return { ok: false, text: "Diese Stelle nimmt gerade keine Bewerbungen an." };
  }

  const name = freigabe.displayName.trim().slice(0, 160);
  if (name.length < 2) return { ok: false, text: "Bitte gib einen Namen an." };

  /* Vor der Transaktion: eine eigene Abfrage gehört nicht in den
     Schreibvorgang, und `await` ist im Rückgabeausdruck nicht erlaubt. */
  const geteilt = await freigabeInhalt(user.id, posting.id, freigabe);

  try {
    await withUser(db, user.id, (tx) =>
      tx
        .insert(schema.postingCandidates)
        .values({
          postingId: posting.id,
          organizationId: posting.organizationId,
          candidateUserId: user.id,
          displayName: name,
          contactEmail: (freigabe.contactEmail || user.email || "").trim().slice(0, 200),
          headline: freigabe.headline?.trim().slice(0, 300) ?? null,
          coverNote: freigabe.coverNote?.trim().slice(0, 8000) ?? null,
          sharedProfile: geteilt,
        })
        .onConflictDoNothing(),
    );
    /*
     * Auch in den Ergebnisstrom, wenn es geht.
     *
     * ── Warum das hier gefehlt hat ──────────────────────────────
     *
     * Das ist der einzige Weg, auf dem tatsächlich Daten an ein
     * Unternehmen gehen — und er lief an `applications` und
     * `recordEvent` vorbei. Velvova-Bewerbungen waren damit in der
     * Trichterdiagnose, im Ergebnisabgleich und beim Nachfassen
     * unsichtbar. Wer sich ausschliesslich hier bewarb, hatte in
     * jeder Auswertung null Bewerbungen.
     *
     * ── Warum es nicht immer geht ───────────────────────────────
     *
     * `applications.jobId` verweist auf `jobs`. Ein Posting ohne
     * `jobId` hat dort keine Entsprechung, und eine Bewerbung ohne
     * Stelle lässt sich nicht anlegen. Dann bleibt es bei der
     * getrennten Liste — sichtbar an der richtigen Stelle, nur nicht
     * in der Auswertung. Das ist eine Lücke des Datenmodells und
     * keine, die diese Funktion schliessen darf.
     */
    if (posting.jobId) {
      try {
        const jobId = posting.jobId;
        const applicationId = await withUser(db, user.id, async (tx) => {
          const [vorhanden] = await tx
            .select({ id: schema.applications.id })
            .from(schema.applications)
            .where(
              and(eq(schema.applications.userId, user.id), eq(schema.applications.jobId, jobId)),
            )
            .limit(1);

          if (vorhanden) {
            await tx
              .update(schema.applications)
              .set({ stage: "sent", lastContactAt: new Date(), updatedAt: new Date() })
              .where(eq(schema.applications.id, vorhanden.id));
            return vorhanden.id;
          }

          const [neu] = await tx
            .insert(schema.applications)
            .values({ userId: user.id, jobId, stage: "sent", lastContactAt: new Date() })
            .returning({ id: schema.applications.id });
          return neu?.id ?? null;
        });

        if (applicationId) {
          const { recordEvent } = await import("@/lib/matching");
          await recordEvent(user.id, "application_sent", { jobId, applicationId });
        }
      } catch (e) {
        /* Die Bewerbung ist raus — daran ändert ein fehlender
           Eintrag nichts. Aber stumm bleibt es nicht. */
        console.error("[arbeitgeber] Bewerbung nicht in den Ergebnisstrom aufgenommen:", e);
      }
    }

    revalidatePath("/app/applications");
    return { ok: true, text: `Bewerbung auf „${posting.title}" ist raus.` };
  } catch (e) {
    console.error("[arbeitgeber] Bewerbung nicht gespeichert:", e);
    return { ok: false, text: "Das konnte ich nicht abschicken." };
  }
}

/** Die eigenen Bewerbungen auf Velvova-Stellen — aus Sicht der Person. */
export async function meineBewerbungen() {
  const user = await requireUser();
  const db = await getDb();
  return withUser(db, user.id, (tx) =>
    tx
      .select({
        id: schema.postingCandidates.id,
        stage: schema.postingCandidates.stage,
        /*
         * `employer_note` steht hier NICHT.
         *
         * Die Gegenrichtung derselben Trennlinie: Was ein Recruiter über
         * jemanden notiert, gehört dem Unternehmen. Eine interne Notiz,
         * die der Bewerber lesen kann, ist keine interne Notiz — und
         * dann schreibt niemand mehr eine ehrliche.
         */
        rejectedReason: schema.postingCandidates.rejectedReason,
        withdrawnAt: schema.postingCandidates.withdrawnAt,
        createdAt: schema.postingCandidates.createdAt,
        stellentitel: schema.jobPostings.title,
        postingId: schema.jobPostings.id,
      })
      .from(schema.postingCandidates)
      .innerJoin(schema.jobPostings, eq(schema.jobPostings.id, schema.postingCandidates.postingId))
      .where(eq(schema.postingCandidates.candidateUserId, user.id))
      .orderBy(desc(schema.postingCandidates.createdAt)),
  );
}

export async function bewerbungZurueckziehen(
  bewerbungId: string,
): Promise<{ ok: boolean; text: string }> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.postingCandidates)
      .set({ withdrawnAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(schema.postingCandidates.id, bewerbungId),
          eq(schema.postingCandidates.candidateUserId, user.id),
        ),
      ),
  );
  revalidatePath("/app/applications");
  return { ok: true, text: "Zurückgezogen." };
}

/**
 * Was tatsächlich beim Arbeitgeber ankommt.
 *
 * ── Warum nur das Band ────────────────────────────────────────
 *
 * „passt gut" ist eine Auskunft, die dem Arbeitgeber hilft und den
 * Menschen nicht ausliefert. Die Faktoren dahinter — belegte
 * Fähigkeiten, Werte, Arbeitsweise — sind sein Profil und bleiben bei
 * ihm.
 *
 * ── Warum aus `job_matches` und nicht neu gerechnet ───────────
 *
 * Dort steht der Wert, der ihm tatsächlich angezeigt wurde. Neu zu
 * rechnen könnte etwas anderes ergeben — und dann stünde beim
 * Arbeitgeber eine Zahl, die die Person nie gesehen hat.
 */
async function freigabeInhalt(
  userId: string,
  postingId: string,
  freigabe: Freigabe,
): Promise<Record<string, unknown>> {
  const grundlage = freigabe.sharedProfile ?? {};
  if (!freigabe.passungTeilen) return grundlage;

  try {
    const db = await getDb();
    const [stelle] = await db
      .select({ jobId: schema.jobPostings.jobId })
      .from(schema.jobPostings)
      .where(eq(schema.jobPostings.id, postingId))
      .limit(1);
    if (!stelle?.jobId) return grundlage;

    const [m] = await withUser(db, userId, (tx) =>
      tx
        .select({ band: schema.jobMatches.fitBand })
        .from(schema.jobMatches)
        .where(
          and(eq(schema.jobMatches.userId, userId), eq(schema.jobMatches.jobId, stelle.jobId!)),
        )
        .limit(1),
    );
    if (!m) return grundlage;

    return { ...grundlage, passungsband: m.band, geteiltAm: new Date().toISOString() };
  } catch (e) {
    /* Ohne Band geht die Bewerbung trotzdem raus. */
    console.error("[arbeitgeber] Passungsband nicht ermittelt:", e);
    return grundlage;
  }
}
