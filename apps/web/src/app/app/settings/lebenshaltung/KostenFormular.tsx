"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  loescheLebenshaltung,
  speichereLebenshaltung,
  type Lebenshaltung,
} from "@/lib/lebenswert/speicher";
import { lebensrechnung } from "@/lib/lebenswert/rechnung";

/**
 * Die monatlichen Kosten — und was daraus folgt.
 *
 * ── Warum die Rechnung neben dem Formular steht ───────────────
 *
 * Ein Formular mit elf Feldern ist eine Zumutung, wenn man nicht sieht,
 * wofür. Deshalb rechnet die rechte Spalte bei jeder Eingabe mit: Wer
 * die Miete einträgt, sieht sofort, was das mit der Zahl unten macht.
 *
 * Das ist auch der Grund, warum nichts verpflichtend ist. Vier Angaben
 * ergeben eine gröbere Rechnung als elf — aber eine, die es vorher
 * nicht gab.
 *
 * ── Was hier nicht steht ──────────────────────────────────────
 *
 * Keine Vergleichswerte, keine „durchschnittlichen Wohnkosten in
 * Deutschland", kein Hinweis, dass jemand zu viel für Abos ausgibt.
 * Diese Seite rechnet, sie bewertet nicht — und ein Produkt, das
 * ungefragt die Lebensführung kommentiert, wird nicht zweimal
 * geöffnet.
 */

const FELDER: { key: keyof Lebenshaltung; label: string; hinweis?: string }[] = [
  { key: "wohnen", label: "Wohnen", hinweis: "Miete oder Rate, Nebenkosten" },
  { key: "energie", label: "Strom und Energie" },
  { key: "versicherungen", label: "Versicherungen" },
  { key: "mobilitaet", label: "Mobilität", hinweis: "Auto, Ticket, ohne Arbeitsweg" },
  { key: "lebensmittel", label: "Lebensmittel" },
  { key: "kredite", label: "Kredite" },
  { key: "abos", label: "Abos" },
  { key: "kinder", label: "Kinder" },
  { key: "freizeit", label: "Freizeit" },
  { key: "sparen", label: "Sparen" },
  { key: "sonstiges", label: "Sonstiges" },
];

export function KostenFormular({
  gespeichert,
  nettoMonat,
  grund,
}: {
  gespeichert: Lebenshaltung;
  /** Aus der aktuellen Stelle, wenn eine hinterlegt ist. Sonst null. */
  nettoMonat: number | null;
  /** Warum es kein Netto gibt — in der Sprache eines Menschen. */
  grund: string | null;
}) {
  const [werte, setWerte] = useState<Record<string, string>>(() => {
    const w: Record<string, string> = {};
    for (const f of FELDER) {
      const v = gespeichert[f.key];
      w[f.key] = v === null || v === undefined ? "" : String(v);
    }
    return w;
  });
  const [meldung, setMeldung] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const alsZahlen = useMemo(() => {
    const z: Lebenshaltung = {};
    for (const f of FELDER) {
      const roh = werte[f.key] ?? "";
      /*
       * Leer heisst „nicht angegeben", nicht „null Euro".
       *
       * Der Unterschied trägt die ganze Rechnung: Ohne ihn liesse sich
       * nicht sagen, wie vollständig sie ist — und eine unvollständige
       * Rechnung, die vollständig aussieht, ist schlimmer als keine.
       */
      (z as Record<string, number | null>)[f.key] =
        roh.trim() === "" ? null : Number(roh.replace(",", "."));
    }
    return z;
  }, [werte]);

  const rechnung = useMemo(
    () => (nettoMonat === null ? null : lebensrechnung(nettoMonat, alsZahlen)),
    [nettoMonat, alsZahlen],
  );

  function speichern() {
    start(async () => {
      const r = await speichereLebenshaltung(alsZahlen);
      setMeldung(r.text);
    });
  }

  function loeschen() {
    start(async () => {
      const r = await loescheLebenshaltung();
      setMeldung(r.text);
      if (r.ok) setWerte(Object.fromEntries(FELDER.map((f) => [f.key, ""])));
    });
  }

  const angegeben = FELDER.filter((f) => (werte[f.key] ?? "").trim() !== "").length;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start">
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {FELDER.map((f) => (
            <label key={f.key} className="grid gap-1.5">
              <span className="text-sm font-medium">{f.label}</span>
              {f.hinweis && <span className="text-2xs text-ink-3">{f.hinweis}</span>}
              <span className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={werte[f.key] ?? ""}
                  onChange={(e) => setWerte((w) => ({ ...w, [f.key]: e.target.value }))}
                  placeholder="—"
                  aria-label={`${f.label} je Monat in Euro`}
                  className="h-11 w-full rounded-(--radius-control) bg-inset pl-3.5 pr-9 text-[15px] tabular outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-3"
                >
                  €
                </span>
              </span>
            </label>
          ))}
        </div>

        <p className="text-sm text-ink-3">
          {angegeben} von {FELDER.length} Angaben. Leere Felder bleiben leer — sie werden nicht als
          null Euro gerechnet, sondern als „nicht angegeben".
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={speichern}
            disabled={pending}
            className="inline-flex h-11 items-center gap-2 rounded-(--radius-control) bg-accent px-5 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Speichern
          </button>
          <button
            type="button"
            onClick={loeschen}
            disabled={pending}
            className="inline-flex h-11 items-center gap-2 rounded-(--radius-control) px-4 text-sm text-ink-2 transition-colors hover:bg-raised hover:text-critical"
          >
            <Trash2 className="size-4" strokeWidth={1.9} />
            Alle Angaben löschen
          </button>
        </div>

        {meldung && (
          <p aria-live="polite" className="text-sm text-ink-2">
            {meldung}
          </p>
        )}
      </div>

      {/* ── Was daraus folgt ──────────────────────────────────── */}
      <aside className="grid gap-4 rounded-(--radius-surface) bg-soft p-6">
        <h3 className="text-sm font-semibold">Was übrig bleibt</h3>

        {nettoMonat === null ? (
          /*
           * Ohne Netto keine Rechnung — und kein Platzhalterbetrag.
           *
           * Eine Zahl an dieser Stelle, die auf einem geschätzten
           * Gehalt beruht, sieht genauso aus wie eine echte.
           */
          <p className="text-sm leading-relaxed text-ink-2">
            {grund ??
              "Sobald ein Nettobetrag berechnet werden kann, steht hier, was nach diesen Kosten übrig bleibt."}
          </p>
        ) : (
          <>
            <Zeile name="Netto im Monat" wert={rechnung!.nettoMonat} />
            <Zeile name="Fixkosten" wert={-rechnung!.fixkostenMonat} />
            <div className="border-t border-line pt-3">
              <Zeile name="Frei verfügbar" wert={rechnung!.freiMonat} stark />
            </div>
            {rechnung!.unbekannt.length > 0 && (
              <p className="text-2xs leading-relaxed text-ink-3">
                Nicht angegeben: {rechnung!.unbekannt.join(", ")}. Diese Posten fehlen in der
                Rechnung.
              </p>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function Zeile({ name, wert, stark }: { name: string; wert: number; stark?: boolean }) {
  const text = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(wert);
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={stark ? "text-sm font-medium" : "text-sm text-ink-2"}>{name}</span>
      <span
        className={
          stark
            ? "font-mono text-lg font-semibold tabular"
            : "font-mono text-sm tabular text-ink-2"
        }
      >
        {text}
      </span>
    </div>
  );
}
