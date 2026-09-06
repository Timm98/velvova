"use server";

import { revalidatePath } from "next/cache";
import { ARBEITSDIMENSIONEN, type Arbeitsdimension } from "@paycheck/domain";
import { requireUser } from "@/lib/auth";
import { angabeErfassen } from "@/lib/arbeitsprofil";

/**
 * Die eigenen Achsen setzen.
 *
 * Als Selbstauskunft — die leichteste Herkunft. Wer sagt „ich arbeite
 * gern unter Druck", hat damit noch nicht unter Druck gearbeitet. Ein
 * Check-in nach neunzig Tagen wiegt doppelt so schwer.
 */
export async function twinSetzen(werte: Record<string, number>): Promise<void> {
  const user = await requireUser();
  for (const [d, wert] of Object.entries(werte)) {
    if (!ARBEITSDIMENSIONEN.includes(d as Arbeitsdimension)) continue;
    if (!Number.isFinite(wert)) continue;
    await angabeErfassen(
      user.id,
      d as Arbeitsdimension,
      wert,
      "selbstauskunft",
      "Selbst eingestellt im Profil",
    );
  }
  revalidatePath("/app/profile");
}
