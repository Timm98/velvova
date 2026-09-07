import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { meineOrganisationen } from "@/lib/arbeitgeber/zugang";
import { ensureWorkflowState, entryRoute } from "@/lib/nina/workflow-state";
import { musstZeigen, standLaden } from "@/lib/nina/einrichtung/speicher";

export const dynamic = "force-dynamic";

/**
 * Wohin nach der Bestätigung.
 *
 * ── Warum das eine eigene Route ist ───────────────────────────
 *
 * Die Entscheidung braucht zwei Abfragen — Organisationen und
 * Vorgangszustand. Im Browser getroffen hiesse, beide dorthin zu
 * geben; und ein Client, der entscheidet, wohin ein bestätigtes Konto
 * gehört, entscheidet über eine Berechtigung.
 *
 * Als eigene Route ist es eine Weiterleitung ohne eigene Oberfläche:
 * Das Formular schickt hierher, hier fällt die Entscheidung, der
 * Browser landet am richtigen Ort.
 *
 * ── Die Reihenfolge ──────────────────────────────────────────
 *
 *   1. Wer eine Organisation hat, gehört in den Arbeitgeberbereich.
 *   2. Wer über „Firmenkonto anlegen" kam, aber noch keine hat, in
 *      dessen Anlage.
 *   3. Alle anderen ins eigene Onboarding — beziehungsweise dorthin,
 *      wo ihr Vorgangszustand sie hinführt.
 */
export default async function WeiterNachBestaetigung({
  searchParams,
}: {
  searchParams: Promise<{ absicht?: string }>;
}) {
  const user = await requireUser();
  const { absicht } = await searchParams;

  /* Unbestätigt hat hier niemand etwas verloren — sonst wäre diese
     Route der Weg an der Bestätigung vorbei. */
  if (!user.emailVerifiedAt) redirect("/bestaetigen");

  const orgs = await meineOrganisationen(user.id);

  /*
   * Mondays Einrichtung kommt vor allem anderen.
   *
   * Sie ist der erste Bildschirm nach der Bestätigung — für beide
   * Kontotypen. Danach greift die Reihenfolge unten wieder, ohne dass
   * sich an ihr etwas ändert: `musstZeigen` ist nach dem ersten Mal
   * falsch, und dann fällt die Weiterleitung hier durch.
   *
   * Wer noch keine Organisation hat, aber eine anlegen will, richtet
   * Monday trotzdem zuerst ein — er ist bis dahin ein Arbeitnehmerkonto
   * und bekommt die passenden Texte. Nach dem Anlegen der Firma zeigt
   * das Privacy Center die Unternehmensfassung.
   */
  const einrichtung = await standLaden(user.id);
  if (musstZeigen(einrichtung)) redirect("/monday-einrichten");

  if (orgs.length > 0) redirect("/business");
  if (absicht === "unternehmen") redirect("/firma");

  const state = await ensureWorkflowState(user.id);
  redirect(entryRoute(state));
}
