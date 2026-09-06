import type { Metadata } from "next";
import { EinladungAnnehmen } from "./EinladungAnnehmen";

export const metadata: Metadata = { title: "Einladung" };
export const dynamic = "force-dynamic";

/**
 * Eine Einladung annehmen.
 *
 * ── Warum ein Knopf und nicht automatisch ─────────────────────
 *
 * Die Seite nimmt die Einladung NICHT beim Aufrufen an. Ein Link, der
 * beim blossen Öffnen eine Mitgliedschaft anlegt, wird von jedem
 * Vorschaudienst ausgelöst, der ihn in einer E-Mail findet — und die
 * Person, für die er gedacht war, findet ihn dann bereits „angenommen".
 *
 * Ausserdem sagt der Knopf, worauf man sich einlässt: Zugang zu
 * Bewerbungsunterlagen anderer Menschen ist nichts, was nebenbei
 * passieren sollte.
 */
export default async function EinladungPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="grid max-w-[var(--measure)] gap-6">
      <div className="grid gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
          Du wurdest eingeladen
        </h1>
        <p className="text-sm leading-relaxed text-ink-2">
          Mit dem Annehmen bekommst du Zugriff auf die Stellen und Bewerbungen dieser Organisation.
          Bewerbungsunterlagen sind persönliche Daten anderer Menschen — geh damit entsprechend um.
        </p>
        <p className="text-sm leading-relaxed text-ink-3">
          Die Einladung gilt nur für die Adresse, an die sie gerichtet ist. Melde dich mit dieser
          Adresse an, sonst wird sie abgelehnt.
        </p>
      </div>
      <EinladungAnnehmen token={token} />
    </div>
  );
}
