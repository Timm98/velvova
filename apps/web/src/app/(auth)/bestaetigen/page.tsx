import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { CodeFormular } from "./CodeFormular";
import { maskiere } from "@/lib/arbeitgeber/bestaetigung";
import { Karte, Titel } from "../Karte";

export const metadata: Metadata = { title: "E-Mail bestätigen" };
export const dynamic = "force-dynamic";

/**
 * Schritt zwei der Einrichtung.
 *
 * ── Warum diese Seite jemanden weiterschickt, der schon da ist ──
 *
 * Eine bestätigte Adresse braucht keine zweite Bestätigung. Wer
 * trotzdem hierher kommt — über ein altes Lesezeichen, über die
 * Fortschrittsleiste — soll nicht vor einem Formular stehen, das
 * nichts mehr zu tun hat.
 */
export default async function BestaetigenPage() {
  const user = await requireUser();
  if (!user.email) redirect("/business/einstellungen");

  /*
   * Wer bereits bestätigt hat, hat hier nichts zu tun.
   *
   * Über die Fortschrittsleiste oder ein altes Lesezeichen landet man
   * sonst vor sechs Feldern, die keinen Zweck mehr haben.
   */
  if (user.emailVerifiedAt) redirect("/bestaetigen/weiter");

  return (
    <div className="grid gap-5">
      <Karte>
        <Titel>E-Mail bestätigen</Titel>
        <CodeFormular adresse={user.email} ziel={await maskiere(user.email)} />
      </Karte>

      <p className="text-center text-xs leading-relaxed text-ink-3">
        Der Code gilt zwanzig Minuten und lässt sich fünfmal eingeben. Danach fordert ihr einen
        neuen an.
      </p>
    </div>
  );
}
