import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Check, CircleDashed, CircleSlash, Minus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { loadScoredJob } from "@/lib/matching";
import { capabilityForJob } from "@/lib/apply/capability-registry";
import { buildPackage, type ItemStatus } from "@/lib/apply/package-builder";
import { buildDecisionBrief } from "@/lib/applications/decision-brief";
import { Badge, Button } from "@/components/ui";
import { PageHeader } from "@/components/ui/states";
import { HandoffConfirm } from "./HandoffConfirm";

export const metadata: Metadata = { title: "Bewerbung vorbereiten" };
export const dynamic = "force-dynamic";

const SYMBOL: Record<ItemStatus, { icon: typeof Check; farbe: string; text: string }> = {
  ready: { icon: Check, farbe: "text-positive", text: "Bereit" },
  needs_review: { icon: CircleDashed, farbe: "text-caution", text: "Noch prüfen" },
  missing: { icon: CircleSlash, farbe: "text-critical", text: "Fehlt" },
  not_required: { icon: Minus, farbe: "text-ink-3", text: "Nicht nötig" },
};

/**
 * Die Bewerbungsbrücke.
 *
 * Hier endet, was dieses Produkt tun kann, und beginnt, was die Person
 * tun muss. Diese Grenze wird nicht verwischt: wir bereiten vor, wir
 * zeigen jede Änderung, wir öffnen die Originalseite — und dann sagt
 * die Person uns, was passiert ist.
 *
 * Ein Redirect ist kein Versand. Der Status bleibt „übergeben", bis
 * jemand ihn bestätigt.
 */
export default async function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { brand } = await getPageContext();

  const scored = await loadScoredJob(user.id, id);
  if (!scored) notFound();

  const brief = buildDecisionBrief({ scored, userYearsExperience: null });
  const capability = capabilityForJob({
    originalUrl: scored.job.originalUrl,
    applyMethod: scored.job.applyMethod,
    applyTarget: scored.job.applyTarget,
  });

  const paket = buildPackage({
    capability,
    claims: null,
    documents: [
      { key: "cv", label: "Lebenslauf", present: false, approved: false, required: true },
      { key: "cover_letter", label: "Anschreiben", present: false, approved: false, required: false },
    ],
    screeningQuestions: [],
    passportFields: [
      { key: "name", label: "Name", filled: Boolean(user.displayName), required: true },
      { key: "email", label: "E-Mail", filled: true, required: true },
    ],
    estimatedMinutes:
      brief.effort.minutesMin !== null && brief.effort.minutesMax !== null
        ? { min: brief.effort.minutesMin, max: brief.effort.minutesMax }
        : null,
  });

  return (
    <div className="grid max-w-[840px] gap-8">
      <PageHeader
        eyebrow="Bewerbung"
        title={scored.job.title}
        lead={`${scored.job.companyName} · ${scored.job.location}`}
      />

      {/* ── Was hier passiert ─────────────────────────────── */}
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge tone={capability.mode === "prepared_redirect" ? "outline" : "positive"}>
            {capability.mode === "prepared_redirect"
              ? "Vorbereiten und weiterleiten"
              : capability.mode === "email_draft"
                ? "E-Mail-Entwurf"
                : capability.mode === "native_apply"
                  ? "Direkte Übermittlung"
                  : "Manuell"}
          </Badge>
          {paket.estimatedMinutes && (
            <span className="font-mono text-2xs uppercase tracking-wider text-ink-3">
              etwa {paket.estimatedMinutes.min}–{paket.estimatedMinutes.max} Min.
            </span>
          )}
        </div>

        <p className="max-w-[var(--measure)] leading-relaxed text-ink-2">
          {capability.explanation}
        </p>

        {capability.missingForBetterMode && (
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-3">
            {capability.missingForBetterMode}
          </p>
        )}
      </section>

      {/* ── Checkliste ────────────────────────────────────── */}
      <section aria-labelledby="checkliste" className="grid gap-4">
        <h2 id="checkliste" className="text-base font-semibold">
          Was für diese Bewerbung gebraucht wird
        </h2>

        <ul className="grid gap-0 divide-y divide-line">
          {paket.items.map((item) => {
            const s = SYMBOL[item.status];
            const Icon = s.icon;
            return (
              <li key={item.key} className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3.5 py-3">
                <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${s.farbe}`} strokeWidth={2} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{item.detail}</p>
                </div>
                {item.action && (
                  <span className="whitespace-nowrap text-xs text-accent-text">{item.action}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Was noch fehlt ────────────────────────────────── */}
      {!paket.ready && (
        <section
          role="note"
          className="grid gap-2 rounded-[--radius-md] border border-caution/30 bg-caution-soft px-4 py-3.5"
        >
          <p className="text-sm font-medium text-caution">{paket.summary}</p>
          <ul className="grid gap-1">
            {paket.blockers.map((b) => (
              <li key={b} className="text-xs leading-relaxed text-ink-2">
                {b}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Übergabe ──────────────────────────────────────── */}
      <section className="grid gap-4 border-t border-line pt-6">
        <h2 className="text-base font-semibold">Der letzte Schritt</h2>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          {brand.assistantName} kann die Bewerbung nicht für dich abschicken — das Formular liegt
          auf der Seite des Arbeitgebers, und dort hat kein fremdes Programm etwas zu suchen. Wir
          öffnen sie für dich, den Rest machst du.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          {scored.job.originalUrl ? (
            <Button asChild variant="primary">
              <a href={scored.job.originalUrl} target="_blank" rel="noopener noreferrer">
                Auf der Originalseite bewerben
                <ArrowUpRight className="size-4" strokeWidth={1.9} />
              </a>
            </Button>
          ) : (
            <p className="text-sm text-ink-3">
              Zu dieser Anzeige liegt keine Adresse vor. Wir können dich nirgendwohin führen.
            </p>
          )}

          <Link
            href={`/app/jobs/${id}`}
            className="inline-flex min-h-10 items-center text-sm text-accent-text underline underline-offset-[3px]"
          >
            Zurück zur Stelle
          </Link>
        </div>

        <p className="text-2xs leading-relaxed text-ink-3">
          Quelle: {scored.source?.displayName ?? "unbekannt"} · zuletzt abgerufen{" "}
          {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(scored.job.fetchedAt)}
        </p>
      </section>

      {/* ── Rückfrage danach ──────────────────────────────── */}
      <HandoffConfirm jobId={id} assistantName={brand.assistantName} />
    </div>
  );
}
