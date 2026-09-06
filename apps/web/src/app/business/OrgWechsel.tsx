"use client";

import { useRouter } from "next/navigation";
import { ROLLENNAME, type Mitgliedschaft } from "@/lib/arbeitgeber/rollen";

/**
 * Zwischen Organisationen wechseln.
 *
 * Bei genau einer wird sie nur benannt, nicht zur Auswahl gestellt: Ein
 * Ausklappfeld mit einem Eintrag ist eine Frage, auf die es nur eine
 * Antwort gibt.
 *
 * Die Rolle steht daneben, weil sie erklärt, warum manche Knöpfe fehlen.
 * „Warum kann ich hier nicht veröffentlichen" ist sonst eine Frage an
 * den Support statt an die eigene Zeile im Team.
 */
export function OrgWechsel({
  orgs,
  aktivId,
}: {
  orgs: Mitgliedschaft[];
  aktivId: string | null;
}) {
  const router = useRouter();
  const aktiv = orgs.find((o) => o.organizationId === aktivId) ?? orgs[0];
  if (!aktiv) return null;

  if (orgs.length === 1) {
    return (
      <p className="flex items-baseline gap-2 text-sm">
        <span className="font-medium text-ink">{aktiv.name}</span>
        <span className="text-2xs text-ink-3">{ROLLENNAME[aktiv.rolle]}</span>
        {!aktiv.verifiziert && (
          <span className="rounded-(--radius-pill) bg-inset px-2 py-0.5 font-mono text-2xs text-ink-3">
            unbestätigt
          </span>
        )}
      </p>
    );
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Organisation wechseln</span>
      <select
        value={aktiv.organizationId}
        onChange={(e) => router.push(`/business?org=${e.target.value}`)}
        className="h-9 rounded-(--radius-control) bg-inset px-2.5 text-sm outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent"
      >
        {orgs.map((o) => (
          <option key={o.organizationId} value={o.organizationId}>
            {o.name} — {ROLLENNAME[o.rolle]}
          </option>
        ))}
      </select>
    </label>
  );
}
