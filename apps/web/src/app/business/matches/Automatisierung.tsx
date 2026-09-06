"use client";

import { useState, useTransition } from "react";
import { Pause, Play } from "lucide-react";
import { automatisierungPausieren, stufeSetzen } from "@/lib/arbeitgeber/match-aktionen";
import { cn } from "@/lib/cn";

/**
 * Die Automatisierungsstufe.
 *
 * ── Warum die Regel immer sichtbar ist, auch auf Stufe 1 ──────
 *
 * Eine Automatisierung, die man nicht sieht, kann man nicht prüfen.
 * Deshalb steht hier immer, was gilt — auch wenn das „Nina rechnet, ein
 * Mensch entscheidet" ist. Wer sie später hochstellt, hat vorher
 * gelesen, was die Stufen bedeuten, statt es aus einem Namen zu raten.
 *
 * ── Warum „Anhalten" ein eigener Knopf ist ────────────────────
 *
 * Wer anhält, will nicht umkonfigurieren. Auf Stufe 1 zurückzustellen
 * verlöre die Bedingungen; anhalten behält sie und schaltet sie später
 * unverändert wieder an.
 */
export function Automatisierung({
  organizationId,
  stufe,
  minFit,
  pausiert,
  darfAendern,
  stufenname,
  erklaerung,
}: {
  organizationId: string;
  stufe: 1 | 2 | 3;
  minFit: number;
  pausiert: boolean;
  darfAendern: boolean;
  stufenname: Record<1 | 2 | 3, string>;
  erklaerung: Record<1 | 2 | 3, string>;
}) {
  const [gewaehlt, setGewaehlt] = useState<1 | 2 | 3>(stufe);
  const [fit, setFit] = useState(minFit);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  function speichern(neu: 1 | 2 | 3, neuerFit: number) {
    setGewaehlt(neu);
    setFit(neuerFit);
    setFehler(null);
    starte(async () => {
      const r = await stufeSetzen(organizationId, null, neu, neuerFit);
      if (!r.ok) setFehler(r.fehler ?? "Das hat nicht geklappt.");
    });
  }

  return (
    <section className="grid gap-4 rounded-(--radius-md) border border-line p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Automatisierung</h2>
        {darfAendern && (
          <button
            type="button"
            disabled={laeuft}
            onClick={() => {
              setFehler(null);
              starte(async () => {
                const r = await automatisierungPausieren(organizationId, !pausiert);
                if (!r.ok) setFehler(r.fehler ?? "Das hat nicht geklappt.");
              });
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-pill) border border-line-3 px-3.5 text-sm font-medium text-ink hover:bg-soft disabled:opacity-55"
          >
            {pausiert ? (
              <>
                <Play aria-hidden className="size-3.5" strokeWidth={2} />
                Fortsetzen
              </>
            ) : (
              <>
                <Pause aria-hidden className="size-3.5" strokeWidth={2} />
                Alles anhalten
              </>
            )}
          </button>
        )}
      </div>

      {pausiert && (
        <p className="rounded-(--radius-sm) border border-caution/40 bg-caution-soft px-3 py-2 text-sm text-ink">
          Angehalten. Es geht nichts an Menschen heraus, die Einstellungen bleiben erhalten.
        </p>
      )}

      <ul className="grid gap-2">
        {([1, 2, 3] as const).map((s) => (
          <li key={s}>
            <label
              className={cn(
                "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-(--radius-sm) p-3 transition-colors",
                gewaehlt === s ? "bg-soft" : "hover:bg-soft",
                !darfAendern && "cursor-not-allowed opacity-70",
              )}
            >
              <input
                type="radio"
                name="stufe"
                checked={gewaehlt === s}
                disabled={!darfAendern || laeuft}
                onChange={() => speichern(s, fit)}
                className="mt-0.5 size-[18px] accent-(--primary)"
              />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium text-ink">
                  {s}. {stufenname[s]}
                </span>
                <span className="text-sm leading-relaxed text-ink-2">{erklaerung[s]}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <label className="flex items-center gap-2.5 text-sm text-ink-2">
          Erst ab Passung
          <select
            value={fit}
            disabled={!darfAendern || laeuft}
            onChange={(e) => speichern(gewaehlt, Number.parseInt(e.target.value, 10))}
            className="h-11 rounded-[10px] border border-line-3 bg-transparent px-3 text-sm text-ink"
          >
            {[60, 70, 80, 90].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {/*
          Der Satz zu Stufe 3 steht dauerhaft da, nicht nur wenn sie
          gewählt ist. Wer die Stufen vergleicht, muss die Bedingung
          kennen, bevor er wählt.
        */}
        <p className="text-xs leading-relaxed text-ink-3">
          Stufe 3 greift nur, wenn auch die Person diese Kontaktart erlaubt hat. Jede automatische
          Handlung wird protokolliert und ist widerrufbar.
        </p>
      </div>

      {fehler && (
        <p role="alert" className="rounded-(--radius-sm) border border-critical/40 bg-critical-soft px-3 py-2 text-sm text-ink">
          {fehler}
        </p>
      )}
    </section>
  );
}
