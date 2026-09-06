"use server";

import { getDb, schema, withUser } from "@paycheck/db";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { inhaltskennung } from "./nina/inhaltskennung";
import { BEREICHE, bereichAus } from "./profil-bereiche.ts";

/**
 * Aktionen am Karriereprofil.
 *
 * Der Mensch entscheidet: bestätigen, bearbeiten, ablehnen, löschen.
 * Das ist keine Nebenfunktion, sondern der Kern - ohne Bestätigung
 * zählt keine Aussage, und ohne Bestätigung des Gesamtprofils gibt es
 * keine personalisierten Jobvorschläge.
 */

export async function confirmEvidence(evidenceId: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.evidenceItems)
      .set({ userConfirmed: true, userRejected: false, updatedAt: new Date() })
      .where(and(eq(schema.evidenceItems.id, evidenceId), eq(schema.evidenceItems.userId, user.id))),
  );
  await recomputeCoverage(user.id);
  revalidatePath("/app/career");
}

export async function rejectEvidence(evidenceId: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  // Abgelehnt heisst: bleibt sichtbar, zählt aber nie wieder. Löschen
  // wäre etwas anderes - und muss ausdrücklich gewählt werden.
  await withUser(db, user.id, async (tx) => {
    /*
     * Beim Ablehnen die Inhaltskennung nachtragen.
     *
     * Sie entsteht normalerweise beim Anlegen. Ältere Zeilen haben sie
     * aus Migration 0019, aber eine, die zwischendurch ohne entstanden
     * ist, würde sonst nach der Ablehnung wiederkommen — und genau das
     * war der Fehler.
     */
    const [zeile] = await tx
      .select({ statement: schema.evidenceItems.statement, hash: schema.evidenceItems.contentHash })
      .from(schema.evidenceItems)
      .where(and(eq(schema.evidenceItems.id, evidenceId), eq(schema.evidenceItems.userId, user.id)))
      .limit(1);

    await tx
      .update(schema.evidenceItems)
      .set({
        userRejected: true,
        userConfirmed: false,
        contentHash: zeile?.hash ?? (zeile ? inhaltskennung(zeile.statement) : null),
        updatedAt: new Date(),
      })
      .where(and(eq(schema.evidenceItems.id, evidenceId), eq(schema.evidenceItems.userId, user.id)));
  });
  await recomputeCoverage(user.id);
  revalidatePath("/app/career");
}

/**
 * Weglegen, ohne zu urteilen.
 *
 * Der dritte Weg neben „stimmt" und „stimmt nicht" — und der, der
 * gefehlt hat. Es gibt Aussagen, die man weder bestätigen noch
 * bestreiten will: sie stimmen halb, sie sind unwichtig, oder man hat
 * gerade keine Lust darauf. Ohne diesen Weg blieb die Fläche stehen,
 * bis jemand urteilte.
 *
 * Anders als Ablehnen ist das KEINE Aussage über den Wahrheitsgehalt.
 * Die Erkenntnis zählt weiterhin nicht als bestätigt, sie wird aber
 * auch nicht als falsch vermerkt — sie ist nur nicht mehr im Weg.
 */
export async function dismissEvidence(evidenceId: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, async (tx) => {
    const [zeile] = await tx
      .select({ statement: schema.evidenceItems.statement, hash: schema.evidenceItems.contentHash })
      .from(schema.evidenceItems)
      .where(and(eq(schema.evidenceItems.id, evidenceId), eq(schema.evidenceItems.userId, user.id)))
      .limit(1);

    await tx
      .update(schema.evidenceItems)
      .set({
        dismissedAt: new Date(),
        contentHash: zeile?.hash ?? (zeile ? inhaltskennung(zeile.statement) : null),
        updatedAt: new Date(),
      })
      .where(and(eq(schema.evidenceItems.id, evidenceId), eq(schema.evidenceItems.userId, user.id)));
  });
  revalidatePath("/app/nina");
}

export async function editEvidence(evidenceId: string, statement: string): Promise<void> {
  const user = await requireUser();
  const trimmed = statement.trim();
  if (trimmed.length === 0 || trimmed.length > 1000) return;

  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.evidenceItems)
      .set({
        statement: trimmed,
        // Eine bearbeitete Aussage gilt als vom Menschen formuliert und
        // damit als bestätigt - er hat sie ja gerade selbst geschrieben.
        sourceType: "user_confirmed",
        userConfirmed: true,
        userRejected: false,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.evidenceItems.id, evidenceId), eq(schema.evidenceItems.userId, user.id))),
  );
  await recomputeCoverage(user.id);
  revalidatePath("/app/career");
}

export async function deleteEvidence(evidenceId: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, async (tx) => {
    await tx
      .update(schema.evidenceItems)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.evidenceItems.id, evidenceId), eq(schema.evidenceItems.userId, user.id)));

    /*
     * Die Löschung auch festhalten.
     *
     * ── Was hier gefehlt hat ──────────────────────────────────
     *
     * Es gab zwei Wege, einen Beleg zu löschen: `deleteSingleItem` in
     * `privacy.ts` schrieb einen Eintrag in `privacy_requests`, diese
     * Fassung nicht. Die Oberfläche benutzt diese hier — und
     * `deleteSingleItem` hatte keinen einzigen Aufrufer.
     *
     * Ergebnis: 16 gelöschte Belege, null Protokolleinträge. Wir
     * könnten nicht zeigen, dass wir gelöscht haben, was jemand
     * gelöscht haben wollte.
     *
     * ── Warum das nicht bloss Buchhaltung ist ─────────────────
     *
     * Die Rechenschaftspflicht verlangt, den Umgang mit
     * personenbezogenen Daten belegen zu können. „Wir haben das
     * bestimmt gelöscht" ist genau die unbelegte Aussage, gegen die
     * dieses Produkt sonst überall argumentiert.
     *
     * `targetRef` hält die Kennung, nicht den Inhalt: Das Protokoll
     * darf nicht bewahren, was gelöscht werden sollte.
     */
    await tx.insert(schema.privacyRequests).values({
      userId: user.id,
      kind: "delete_item",
      status: "done",
      targetRef: evidenceId,
      completedAt: new Date(),
    });
  });
  await recomputeCoverage(user.id);
  revalidatePath("/app/career");
}

export async function addEvidence(statement: string, type: string): Promise<void> {
  const user = await requireUser();
  const trimmed = statement.trim();
  if (trimmed.length < 10) return;

  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx.insert(schema.evidenceItems).values({
      userId: user.id,
      type: type as (typeof schema.evidenceItems.$inferInsert)["type"],
      statement: trimmed.slice(0, 1000),
      sourceType: "user_stated",
      sourceRef: "profile:manual",
      confidence: 0.9,
      userConfirmed: true,
    }),
  );
  await recomputeCoverage(user.id);
  revalidatePath("/app/career");
}

export async function confirmRoleCluster(clusterId: string, confirmed: boolean): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.roleClusters)
      .set({ userConfirmed: confirmed })
      .where(and(eq(schema.roleClusters.id, clusterId), eq(schema.roleClusters.userId, user.id))),
  );
  revalidatePath("/app/career");
}

/**
 * Das Profil bestätigen. Erst danach erscheinen personalisierte
 * Jobvorschläge - vorher wären es Zufallstreffer.
 */
export async function confirmProfile(): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  await withUser(db, user.id, async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.careerProfiles)
      .where(eq(schema.careerProfiles.userId, user.id))
      .limit(1);

    if (existing) {
      await tx
        .update(schema.careerProfiles)
        .set({ confirmedByUser: true, confirmedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.careerProfiles.id, existing.id));
    } else {
      await tx
        .insert(schema.careerProfiles)
        .values({ userId: user.id, confirmedByUser: true, confirmedAt: new Date() });
    }
  });

  await recomputeCoverage(user.id);
  revalidatePath("/app/career");
  revalidatePath("/app/jobs");
  revalidatePath("/app");
}

/**
 * Abdeckung neu bestimmen. Sie misst, wie viel des Profils belegt ist -
 * und fliesst ausschließlich in die Confidence, nie in den Fit.
 */
export async function recomputeCoverage(userId: string): Promise<number> {
  const db = await getDb();

  return withUser(db, userId, async (tx) => {
    const evidence = await tx
      .select()
      .from(schema.evidenceItems)
      .where(and(eq(schema.evidenceItems.userId, userId), isNull(schema.evidenceItems.deletedAt)));

    const confirmed = evidence.filter((e) => e.userConfirmed && !e.userRejected);

    const covered = BEREICHE.filter((b) =>
      confirmed.some((e) => bereichAus(e.sourceRef) === b),
    ).length;
    // `BEREICHE` ist eine feste Liste — die frühere Division-durch-null-
    // Absicherung war ein toter Zweig, den der Compiler zu Recht anmerkt.
    const coverage = covered / BEREICHE.length;

    const [profile] = await tx
      .select()
      .from(schema.careerProfiles)
      .where(eq(schema.careerProfiles.userId, userId))
      .limit(1);

    if (profile) {
      await tx
        .update(schema.careerProfiles)
        .set({ coverage, updatedAt: new Date() })
        .where(eq(schema.careerProfiles.id, profile.id));
    } else {
      /*
       * Ohne Zeile wurde die Abdeckung berechnet und weggeworfen.
       *
       * Diese Funktion läuft bei jeder Belegänderung. Sie zählte
       * korrekt, wie viele der sieben Bereiche abgedeckt sind — und
       * schrieb das Ergebnis nur, wenn zufällig schon ein Profil
       * existierte. Ein Profil entstand aber ausschliesslich beim
       * Klick auf „Profil bestätigen", also ganz am Ende.
       *
       * Bis dahin las die Oberfläche `profile?.coverage ?? 0` und
       * zeigte 0 Prozent — egal wie viel jemand beantwortet hatte. Der
       * Fortschrittsbalken stand still, während das Gespräch lief.
       *
       * In der Datenbank sah man es an einem Verhältnis, das nicht
       * sein kann: 319 Belege, 0 Karriereprofile.
       *
       * `confirmedByUser` bleibt dabei ausdrücklich falsch. Die
       * Abdeckung ist eine MESSUNG, keine Zustimmung — sie zu
       * speichern darf nicht bedeuten, dass jemand etwas bestätigt
       * hat.
       */
      await tx.insert(schema.careerProfiles).values({
        userId,
        coverage,
        confirmedByUser: false,
      });
    }

    return coverage;
  });
}
