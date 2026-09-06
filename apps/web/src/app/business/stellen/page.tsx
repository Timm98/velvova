import type { Metadata } from "next";
import Link from "next/link";
import { arbeitgeberKontext, darf } from "@/lib/arbeitgeber/zugang";
import { ladeStellen } from "@/lib/arbeitgeber/stellen";
import { NeueStelle } from "./NeueStelle";

export const metadata: Metadata = { title: "Stellen" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  draft: "Entwurf",
  published: "Veröffentlicht",
  closed: "Geschlossen",
};

export default async function StellenPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org } = await searchParams;
  const { organisation } = await arbeitgeberKontext(org);
  const stellen = await ladeStellen(organisation.organizationId);

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">Stellen</h1>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Entwürfe sind nur hier sichtbar. Veröffentlichte Stellen stehen im Stellenindex und
            sind als „Direkt vom Arbeitgeber" gekennzeichnet.
          </p>
        </div>
        {darf(organisation.rolle, "recruiter") && (
          <NeueStelle orgId={organisation.organizationId} />
        )}
      </div>

      {stellen.length === 0 ? (
        <p className="max-w-[var(--measure)] rounded-(--radius-surface) bg-soft p-5 text-sm leading-relaxed text-ink-2">
          Noch keine Stelle. Leg einen Entwurf an — veröffentlichen kannst du später, und bis dahin
          sieht ihn niemand ausserhalb deiner Organisation.
        </p>
      ) : (
        <ul className="grid gap-3">
          {stellen.map(({ posting, bewerbungen }) => (
            <li key={posting.id}>
              <Link
                href={`/business/stellen/${posting.id}`}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 rounded-(--radius-surface) bg-surface p-5 ring-1 ring-line transition-colors hover:bg-soft"
              >
                <span className="grid gap-1">
                  <span className="text-[15px] font-semibold text-ink">{posting.title}</span>
                  <span className="text-2xs text-ink-2">
                    {posting.location || "kein Ort angegeben"} ·{" "}
                    {STATUS[posting.status] ?? posting.status}
                  </span>
                </span>
                <span className="text-sm text-ink-2">
                  {bewerbungen === 0
                    ? "keine Bewerbung"
                    : `${bewerbungen} ${bewerbungen === 1 ? "Bewerbung" : "Bewerbungen"}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
