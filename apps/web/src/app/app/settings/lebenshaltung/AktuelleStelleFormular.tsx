"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { speichereAktuelleStelle, type AktuelleStelle } from "@/lib/lebenswert/speicher";

/**
 * Die aktuelle Stelle — die Seite, gegen die verglichen wird.
 *
 * ── Warum so wenige Felder ────────────────────────────────────
 *
 * Es geht nicht darum, den jetzigen Job zu dokumentieren. Es geht um
 * die vier Zahlen, die eine Frage beantworten: „Lohnt sich ein
 * Wechsel?"
 *
 * Brutto, Arbeitsmodell, Bürotage, Arbeitsweg. Titel und Firma stehen
 * nur dabei, damit die Vergleichsspalte einen Namen hat.
 *
 * Ein längeres Formular hätte hier einen doppelten Preis: Es kostet
 * Zeit, und niemand füllt es aus — womit auch die vier Zahlen fehlen,
 * auf die es ankommt.
 *
 * ── Der Arbeitsweg wird gefragt, nicht gerechnet ──────────────
 *
 * Es gibt keinen Routingdienst, und eine geschätzte Fahrzeit wäre hier
 * besonders teuer: Sie ginge direkt in eine Differenz ein, nach der
 * jemand eine Entscheidung trifft. Wer täglich fährt, weiss die Zahl
 * ohnehin besser als jede Karte.
 */
export function AktuelleStelleFormular({ gespeichert }: { gespeichert: AktuelleStelle | null }) {
  const [w, setW] = useState({
    jobTitle: gespeichert?.jobTitle ?? "",
    companyName: gespeichert?.companyName ?? "",
    grossAmount: gespeichert?.grossAmount === null ? "" : String(gespeichert?.grossAmount ?? ""),
    salaryPeriod: gespeichert?.salaryPeriod ?? "year",
    workModel: gespeichert?.workModel ?? "",
    weeklyHours: gespeichert?.weeklyHours === null ? "" : String(gespeichert?.weeklyHours ?? ""),
    officeDaysPerWeek:
      gespeichert?.officeDaysPerWeek === null ? "" : String(gespeichert?.officeDaysPerWeek ?? ""),
    commuteMinutes:
      gespeichert?.commuteMinutes === null ? "" : String(gespeichert?.commuteMinutes ?? ""),
  });
  const [meldung, setMeldung] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const zahl = (s: string) => (s.trim() === "" ? null : Math.round(Number(s.replace(",", "."))));

  function speichern() {
    start(async () => {
      const r = await speichereAktuelleStelle({
        jobTitle: w.jobTitle.trim() || null,
        companyName: w.companyName.trim() || null,
        grossAmount: zahl(w.grossAmount),
        salaryPeriod: w.salaryPeriod as AktuelleStelle["salaryPeriod"],
        workModel: (w.workModel || null) as AktuelleStelle["workModel"],
        weeklyHours: zahl(w.weeklyHours),
        officeDaysPerWeek: zahl(w.officeDaysPerWeek),
        commuteMinutes: zahl(w.commuteMinutes),
      });
      setMeldung(r.text);
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Feld label="Position" wert={w.jobTitle} setze={(v) => setW({ ...w, jobTitle: v })} />
        <Feld label="Unternehmen" wert={w.companyName} setze={(v) => setW({ ...w, companyName: v })} />

        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Bruttogehalt</span>
          <span className="flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={w.grossAmount}
              onChange={(e) => setW({ ...w, grossAmount: e.target.value })}
              placeholder="—"
              aria-label="Bruttogehalt"
              className="h-11 min-w-0 flex-1 rounded-(--radius-control) bg-inset px-3.5 text-[15px] tabular outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent"
            />
            <select
              value={w.salaryPeriod}
              onChange={(e) => setW({ ...w, salaryPeriod: e.target.value as typeof w.salaryPeriod })}
              aria-label="Zeitraum"
              className="h-11 shrink-0 rounded-(--radius-control) bg-inset px-3 text-sm outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent"
            >
              <option value="year">pro Jahr</option>
              <option value="month">pro Monat</option>
            </select>
          </span>
        </label>

        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Arbeitsmodell</span>
          <select
            value={w.workModel}
            onChange={(e) => setW({ ...w, workModel: e.target.value })}
            className="h-11 rounded-(--radius-control) bg-inset px-3 text-[15px] outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">nicht angegeben</option>
            <option value="on_site">vor Ort</option>
            <option value="hybrid">hybrid</option>
            <option value="remote">remote</option>
          </select>
        </label>

        <Feld
          label="Wochenstunden"
          hinweis="wie im Vertrag"
          wert={w.weeklyHours}
          setze={(v) => setW({ ...w, weeklyHours: v })}
        />
        <Feld
          label="Bürotage je Woche"
          wert={w.officeDaysPerWeek}
          setze={(v) => setW({ ...w, officeDaysPerWeek: v })}
        />
        <Feld
          label="Arbeitsweg je Richtung"
          hinweis="in Minuten, wie du ihn kennst"
          wert={w.commuteMinutes}
          setze={(v) => setW({ ...w, commuteMinutes: v })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={speichern}
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-(--radius-control) bg-accent px-5 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Speichern
        </button>
        {meldung && (
          <span aria-live="polite" className="text-sm text-ink-2">
            {meldung}
          </span>
        )}
      </div>
    </div>
  );
}

function Feld({
  label,
  hinweis,
  wert,
  setze,
}: {
  label: string;
  hinweis?: string;
  wert: string;
  setze: (v: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {hinweis && <span className="text-2xs text-ink-3">{hinweis}</span>}
      <input
        type="text"
        value={wert}
        onChange={(e) => setze(e.target.value)}
        placeholder="—"
        aria-label={label}
        className="h-11 rounded-(--radius-control) bg-inset px-3.5 text-[15px] outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent"
      />
    </label>
  );
}
