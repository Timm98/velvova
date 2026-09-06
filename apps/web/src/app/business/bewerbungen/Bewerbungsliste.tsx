"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { notizSpeichern, stufeSetzen } from "@/lib/arbeitgeber/bewerbungen";
import type { Stufe } from "@/lib/arbeitgeber/stufen";

interface Bewerbung {
  id: string;
  displayName: string;
  contactEmail: string;
  headline: string | null;
  coverNote: string | null;
  stage: string;
  employerNote: string;
  rejectedReason: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  stellentitel: string;
}

/**
 * Bewerbungen nach Stufe, mit Notiz und Absagegrund.
 *
 * ── Warum eine Absage einen Grund braucht ─────────────────────
 *
 * Die Aktion verweigert eine Absage ohne Begründung. Das ist keine
 * Bevormundung: Eine Absage ohne Grund ist die häufigste und die am
 * meisten kritisierte Erfahrung im ganzen Bewerbungsprozess. Ein Satz
 * kostet dreissig Sekunden und erspart jemandem wochenlanges Rätseln.
 *
 * Der Grund geht NICHT automatisch hinaus — was mitgeteilt wird,
 * entscheidet das Unternehmen. Er steht am Datensatz, damit die
 * Entscheidung nachvollziehbar bleibt, auch für die Kollegin, die den
 * Fall drei Wochen später übernimmt.
 */
export function Bewerbungsliste({
  orgId,
  bewerbungen,
  stufen,
  darfBearbeiten,
}: {
  orgId: string;
  bewerbungen: Bewerbung[];
  stufen: { key: string; label: string }[];
  darfBearbeiten: boolean;
}) {
  return (
    <div className="grid gap-4">
      {bewerbungen.map((b) => (
        <Karte key={b.id} b={b} orgId={orgId} stufen={stufen} darfBearbeiten={darfBearbeiten} />
      ))}
    </div>
  );
}

function Karte({
  b,
  orgId,
  stufen,
  darfBearbeiten,
}: {
  b: Bewerbung;
  orgId: string;
  stufen: { key: string; label: string }[];
  darfBearbeiten: boolean;
}) {
  const [stufe, setStufe] = useState(b.stage);
  const [notiz, setNotiz] = useState(b.employerNote);
  const [grund, setGrund] = useState(b.rejectedReason ?? "");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const abgesagt = stufe === "rejected";

  return (
    <article
      className={
        "grid gap-4 rounded-(--radius-surface) p-5 ring-1 " +
        (b.withdrawnAt ? "bg-inset ring-line opacity-70" : "bg-surface ring-line")
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className="grid gap-0.5">
          <h2 className="text-[15px] font-semibold text-ink">{b.displayName}</h2>
          <p className="text-2xs text-ink-2">
            {b.stellentitel} · beworben am{" "}
            {new Date(b.createdAt).toLocaleDateString("de-DE")}
          </p>
        </div>
        <a
          href={`mailto:${b.contactEmail}`}
          className="text-sm text-accent-text underline underline-offset-[3px]"
        >
          {b.contactEmail}
        </a>
      </div>

      {b.withdrawnAt && (
        <p className="text-sm text-ink-2">
          Diese Bewerbung wurde zurückgezogen. Sie bleibt sichtbar, damit nachvollziehbar ist, was
          passiert ist.
        </p>
      )}

      {b.headline && <p className="text-sm text-ink">{b.headline}</p>}
      {b.coverNote && (
        <p className="max-w-[var(--measure)] whitespace-pre-line text-sm leading-relaxed text-ink-2">
          {b.coverNote}
        </p>
      )}

      {darfBearbeiten && !b.withdrawnAt && (
        <div className="grid gap-3 border-t border-line pt-4">
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Stand</span>
            {/*
             * Ausdrückliches `aria-label`, obwohl das Feld in einem
             * `<label>` steht.
             *
             * Der zugängliche Name eines umschliessenden Labels ist sein
             * gesamter Textinhalt — also „Stand" PLUS dem Text der
             * gewählten Option. Er ändert sich damit, sobald jemand die
             * Auswahl ändert. Für eine Person mit Screenreader heisst
             * das Feld beim zweiten Hinhören anders als beim ersten.
             */}
            <select
              aria-label="Stand"
              value={stufe}
              onChange={(e) => setStufe(e.target.value)}
              className="h-9 rounded-(--radius-control) bg-inset px-2.5 text-sm outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent"
            >
              {stufen.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          {abgesagt && (
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Grund der Absage</span>
              <span className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
                Mindestens ein Satz. Er geht nicht automatisch hinaus — aber ohne ihn ist in drei
                Wochen nicht mehr nachvollziehbar, warum abgesagt wurde.
              </span>
              <textarea
                value={grund}
                onChange={(e) => setGrund(e.target.value)}
                rows={2}
                aria-label="Grund der Absage"
                className="rounded-(--radius-control) bg-inset p-3 text-sm leading-relaxed outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent"
              />
            </label>
          )}

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Interne Notiz</span>
            <span className="text-2xs text-ink-3">Nur für dein Team. Die Person sieht sie nicht.</span>
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={2}
              aria-label="Interne Notiz"
              className="rounded-(--radius-control) bg-inset p-3 text-sm leading-relaxed outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const a = await stufeSetzen(orgId, b.id, stufe as Stufe, grund);
                  const c = await notizSpeichern(orgId, b.id, notiz);
                  setMeldung(a.ok ? c.text : a.text);
                })
              }
              className="inline-flex h-10 items-center gap-2 rounded-(--radius-control) bg-accent px-4 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
              Übernehmen
            </button>
            {meldung && (
              <span role="status" className="max-w-[var(--measure)] text-sm text-ink-2">
                {meldung}
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
