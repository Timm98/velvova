"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sucheFuerProjekt, type Suchbefund } from "./projektsuche";
import { auftragBestaetigen } from "@/lib/suchauftrag/aktionen";

/**
 * Die zwei Handgriffe an der Suche eines Vorhabens.
 *
 * ── Warum das Einrichten einen eigenen Knopf hat ────────────────
 *
 * Monday legt die Suche mit an, wenn sie im Gespräch ein Vorhaben
 * erkennt. Zwei Fälle bleiben trotzdem übrig: Das Vorhaben ist von
 * Hand angelegt worden, oder das Ziel war beim Erkennen noch zu dünn
 * für Kriterien. Ohne Knopf stünde die Seite dann dauerhaft auf
 * „keine Suche" und niemand käme weiter.
 *
 * ── Warum Starten und Einrichten getrennt sind ──────────────────
 *
 * Weil das zwei Entscheidungen sind. Eingerichtet heisst: So habe ich
 * dich verstanden. Gestartet heisst: Such danach. Eine Oberfläche,
 * die beides in einen Knopf legt, lässt die Person das Zweite tun,
 * während sie das Erste liest.
 */

export async function sucheEinrichten(projektId: string): Promise<Suchbefund> {
  const user = await requireUser();
  const befund = await sucheFuerProjekt(user.id, projektId, await zielVon(user.id, projektId));
  revalidatePath(`/app/projekte/${projektId}`);
  return befund;
}

export async function sucheStarten(
  projektId: string,
  auftragId: string,
): Promise<{ ok: true } | { ok: false; grund: string }> {
  const befund = await auftragBestaetigen(auftragId);
  revalidatePath(`/app/projekte/${projektId}`);
  return befund;
}

/* Das Ziel wird hier gelesen und nicht übergeben: Ein Wunsch, den der
   Browser mitschickt, ist ein Wunsch, den der Browser ändern kann. */
async function zielVon(userId: string, projektId: string): Promise<string | null> {
  const { projektLaden } = await import("./projekte");
  const p = await projektLaden(userId, projektId);
  return p?.ziel ?? null;
}
