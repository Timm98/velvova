import type { Metadata } from "next";
import { bestaetigungPruefen } from "@/lib/suchauftrag/benachrichtigung";
import { BestaetigenKnopf } from "./BestaetigenKnopf";

export const metadata: Metadata = { title: "Jobmails bestätigen", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Der zweite Schritt des Double-Opt-in.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Aufruf allein nichts bestätigt
 * ══════════════════════════════════════════════════════════════
 *
 * Beim Abmelden ist der Virenscanner ein Ärgernis: Er meldet jemanden
 * ab, der es nicht wollte.
 *
 * Hier ist er das grössere Problem. Ein Scanner, der den Link öffnet,
 * bestätigt eine Adresse, deren Besitzer nie geklickt hat — und hebelt
 * damit genau das aus, wofür der Double-Opt-in da ist. Der Nachweis
 * wäre dann ein Zeitstempel ohne Aussage.
 *
 * Also: Diese Seite zeigt einen Knopf. Das POST bestätigt.
 */
export default async function BestaetigenSeite({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const token = (t ?? "").trim();
  const befund = token ? await bestaetigungPruefen(token) : ({ ok: false, grund: "unbekannt" } as const);

  return (
    <div className="mx-auto grid max-w-[34rem] gap-6 py-16">
      <h1 className="font-display text-[2rem] font-medium leading-[1.1] tracking-[-0.02em]">
        Jobmails bestätigen
      </h1>

      {befund.ok ? (
        <>
          <p className="text-[0.95rem] leading-relaxed text-muted">
            Damit bekommst du deine passenden Stellen künftig auch per E-Mail
            {befund.adresse ? ` an ${befund.adresse}` : ""}. Abbestellen kannst du sie jederzeit
            mit einem Klick — der Link steht in jeder Mail.
          </p>
          <BestaetigenKnopf token={token} />
        </>
      ) : (
        <p className="text-[0.95rem] leading-relaxed text-muted">
          {befund.grund === "abgelaufen"
            ? "Dieser Bestätigungslink ist abgelaufen. Trage deine Adresse in Velvova noch einmal ein — dann kommt ein neuer."
            : "Dieser Link gilt nicht. Trage deine Adresse in Velvova ein, um Jobmails einzuschalten."}
        </p>
      )}
    </div>
  );
}
