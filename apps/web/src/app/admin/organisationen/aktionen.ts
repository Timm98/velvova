"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@paycheck/db";
import { flags } from "@paycheck/config";
import { requireUser } from "@/lib/auth";

/**
 * Ein Arbeitgeberkonto bestätigen oder die Bestätigung zurücknehmen.
 *
 * Die Rollenprüfung steht HIER und nicht nur auf der Seite. Eine
 * Serveraktion ist ein Endpunkt: Sie lässt sich aufrufen, ohne die Seite
 * je gesehen zu haben. Eine Prüfung, die nur im Seitenaufbau steht,
 * schützt die Ansicht und nicht die Handlung.
 */
export async function organisationBestaetigen(
  orgId: string,
  bestaetigt: boolean,
): Promise<{ ok: boolean; text: string }> {
  const user = await requireUser();
  if (!flags.adminArea || (user.role !== "operator" && user.role !== "admin")) {
    return { ok: false, text: "Dafür fehlt dir die Berechtigung." };
  }

  const db = await getDb();
  await db
    .update(schema.organizations)
    .set({ verifiedAt: bestaetigt ? new Date() : null })
    .where(eq(schema.organizations.id, orgId));

  /*
   * Beim Zurücknehmen bleiben veröffentlichte Stellen stehen.
   *
   * Sie sind bereits im Index, und Menschen haben sich vielleicht schon
   * beworben. Sie stillschweigend verschwinden zu lassen träfe die
   * Falschen. Was die Bestätigung steuert, ist das VERÖFFENTLICHEN —
   * neue Stellen gehen nicht mehr hinaus, und das ist der Hebel, um den
   * es geht.
   */
  revalidatePath("/admin/organisationen");
  revalidatePath("/business");
  return { ok: true, text: bestaetigt ? "Bestätigt." : "Bestätigung zurückgenommen." };
}
