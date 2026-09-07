import type { Metadata } from "next";
import { arbeitgeberKontext, darf } from "@/lib/arbeitgeber/zugang";
import { ladeBewerbungen } from "@/lib/arbeitgeber/bewerbungen";
import { STUFEN } from "@/lib/arbeitgeber/stufen";
import { Bewerbungsliste } from "./Bewerbungsliste";

export const metadata: Metadata = { title: "Bewerbungen" };
export const dynamic = "force-dynamic";

/**
 * Die Bewerbungen einer Organisation.
 *
 * ── Was hier steht und was nicht ──────────────────────────────
 *
 * Name, Kontakt, Kurzbeschreibung, Anschreiben — genau die Angaben, die
 * jemand für DIESE Stelle freigegeben hat, so wie sie zum Zeitpunkt der
 * Bewerbung waren.
 *
 * Nicht hier: der Monday-Chat, die Lebenshaltung, das aktuelle Gehalt, die
 * Steuerangaben, andere Bewerbungen, gespeicherte Stellen. Nicht, weil
 * die Abfrage sie weglässt, sondern weil sie in dieser Tabelle nicht
 * stehen und die Zeilensicherheit sie anderswo nicht herausgibt.
 */
export default async function BewerbungenPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; stelle?: string }>;
}) {
  const { org, stelle } = await searchParams;
  const { organisation } = await arbeitgeberKontext(org);
  const bewerbungen = await ladeBewerbungen(organisation.organizationId, stelle);

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-2xl font-normal tracking-[-0.02em]">Bewerbungen</h1>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Was du hier siehst, hat die Person für diese eine Stelle freigegeben. Ihr Karrieregespräch
          mit Monday, ihre Lebenshaltung und ihr aktuelles Gehalt sind für uns nicht abrufbar — auch
          nicht auf Anfrage.
        </p>
      </div>

      {bewerbungen.length === 0 ? (
        <p className="max-w-[var(--measure)] rounded-(--radius-surface) bg-soft p-5 text-sm leading-relaxed text-ink-2">
          Noch keine Bewerbung. Sobald eine Stelle veröffentlicht ist und sich jemand bewirbt,
          steht sie hier.
        </p>
      ) : (
        <Bewerbungsliste
          orgId={organisation.organizationId}
          bewerbungen={bewerbungen.map((b) => ({
            ...b,
            createdAt: b.createdAt.toISOString(),
            withdrawnAt: b.withdrawnAt?.toISOString() ?? null,
          }))}
          stufen={[...STUFEN]}
          darfBearbeiten={darf(organisation.rolle, "recruiter")}
        />
      )}
    </div>
  );
}
