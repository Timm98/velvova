"use server";

import { getDb, schema, withUser } from "@paycheck/db";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";

/**
 * Aktionen am Karriereprofil.
 *
 * Der Mensch entscheidet: bestaetigen, bearbeiten, ablehnen, loeschen.
 * Das ist keine Nebenfunktion, sondern der Kern - ohne Bestaetigung
 * zaehlt keine Aussage, und ohne Bestaetigung des Gesamtprofils gibt es
 * keine personalisierten Jobvorschlaege.
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
  revalidatePath("/app/profile");
}

export async function rejectEvidence(evidenceId: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  // Abgelehnt heisst: bleibt sichtbar, zaehlt aber nie wieder. Loeschen
  // waere etwas anderes - und muss ausdruecklich gewaehlt werden.
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.evidenceItems)
      .set({ userRejected: true, userConfirmed: false, updatedAt: new Date() })
      .where(and(eq(schema.evidenceItems.id, evidenceId), eq(schema.evidenceItems.userId, user.id))),
  );
  await recomputeCoverage(user.id);
  revalidatePath("/app/profile");
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
        // damit als bestaetigt - er hat sie ja gerade selbst geschrieben.
        sourceType: "user_confirmed",
        userConfirmed: true,
        userRejected: false,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.evidenceItems.id, evidenceId), eq(schema.evidenceItems.userId, user.id))),
  );
  await recomputeCoverage(user.id);
  revalidatePath("/app/profile");
}

export async function deleteEvidence(evidenceId: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.evidenceItems)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.evidenceItems.id, evidenceId), eq(schema.evidenceItems.userId, user.id))),
  );
  await recomputeCoverage(user.id);
  revalidatePath("/app/profile");
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
  revalidatePath("/app/profile");
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
  revalidatePath("/app/profile");
}

/**
 * Das Profil bestaetigen. Erst danach erscheinen personalisierte
 * Jobvorschlaege - vorher waeren es Zufallstreffer.
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
  revalidatePath("/app/profile");
  revalidatePath("/app/jobs");
  revalidatePath("/app");
}

/**
 * Abdeckung neu bestimmen. Sie misst, wie viel des Profils belegt ist -
 * und fliesst ausschliesslich in die Confidence, nie in den Fit.
 */
export async function recomputeCoverage(userId: string): Promise<number> {
  const db = await getDb();

  return withUser(db, userId, async (tx) => {
    const evidence = await tx
      .select()
      .from(schema.evidenceItems)
      .where(and(eq(schema.evidenceItems.userId, userId), isNull(schema.evidenceItems.deletedAt)));

    const confirmed = evidence.filter((e) => e.userConfirmed && !e.userRejected);

    // Abdeckung ueber die Bereiche, die ein tragfaehiges Profil braucht.
    const areas = [
      "experience_episodes", "tasks_and_energy", "hard_constraints",
      "location_and_logistics", "work_style_and_environment",
      "values_and_motives", "background",
    ];
    const covered = areas.filter((a) => confirmed.some((e) => e.sourceRef?.includes(a))).length;
    const coverage = areas.length === 0 ? 0 : covered / areas.length;

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
    }

    return coverage;
  });
}
