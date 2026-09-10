"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Check, X, Clock } from "lucide-react";
import { loesungPruefen, type Probenlage } from "@/lib/bruecke/probe";
import type { Aufgabe } from "@paycheck/domain";
import { cn } from "@/lib/cn";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Arbeitsprobe, wie ein Mensch sie durchläuft
 * ══════════════════════════════════════════════════════════════════
 *
 * Drei Zustände, und der mittlere ist der wichtigste:
 *
 *   Aufgabe      Was zu tun ist, was erlaubt ist, wie lange.
 *   Bewertung    Die Prüfpunkte, offen gelegt — auch die verfehlten.
 *   Zeugnis      Nur bei Bestehen. Sonst bleibt nichts zurück.
 *
 * ── Warum die Prüfpunkte erst danach zu sehen sind ──────────────
 *
 * Vorher wären sie die Lösung. Danach sind sie die Rechnung: Wer
 * sieht, woran gemessen wurde, kann widersprechen — und ein
 * Widerspruch, den es geben kann, ist der Grund, warum man dem
 * Ergebnis glaubt.
 *
 * ── Warum ein Misserfolg nichts hinterlässt ─────────────────────
 *
 * Kein Eintrag, keine Zählung, kein „zweiter Versuch". Ein System, in
 * dem Üben aktenkundig wird, ist ein System, in dem niemand übt. Die
 * Regel steht in `wirdFestgehalten()`; hier steht nichts, was sie
 * umgehen könnte.
 */

const KNOPF =
  "inline-flex min-h-11 items-center gap-2 rounded-(--radius-control) px-4 text-[14px] font-medium transition-colors disabled:opacity-60";

export function Arbeitsprobe({
  jobId,
  aufgabe,
}: {
  jobId: string;
  aufgabe: Aufgabe;
}) {
  const [loesung, setLoesung] = useState("");
  const [lage, setLage] = useState<Probenlage | null>(null);
  const [laeuft, uebergang] = useTransition();

  function abgeben() {
    uebergang(async () => {
      const a = await loesungPruefen(
        jobId,
        aufgabe.taetigkeit,
        aufgabe.text,
        aufgabe.hilfsmittel,
        aufgabe.minuten,
        aufgabe.pruefpunkte,
        loesung,
      );
      setLage(a);
    });
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 rounded-(--radius-lg) border border-line bg-raised p-6">
        <div className="grid gap-1">
          <span className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-3">
            {aufgabe.taetigkeit}
          </span>
          <h2 className="text-[17px] font-semibold text-ink">Die Aufgabe</h2>
        </div>

        <p className="max-w-[var(--measure)] whitespace-pre-line text-[15px] leading-relaxed text-ink-2">
          {aufgabe.text}
        </p>

        <div className="flex flex-wrap gap-x-6 gap-y-1.5 border-t border-line pt-3.5 text-2xs text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5 shrink-0" strokeWidth={1.8} />
            {aufgabe.minuten} Minuten vorgesehen
          </span>
          <span>
            {aufgabe.hilfsmittel.length > 0
              ? `Erlaubt: ${aufgabe.hilfsmittel.join(", ")}`
              : "Ohne Hilfsmittel"}
          </span>
          <span>{aufgabe.pruefpunkte.length} Prüfpunkte</span>
        </div>
      </section>

      {!lage && (
        <section className="grid gap-3">
          <label htmlFor="loesung" className="text-[15px] font-medium text-ink">
            Deine Lösung
          </label>
          <textarea
            id="loesung"
            value={loesung}
            onChange={(e) => setLoesung(e.target.value)}
            rows={12}
            disabled={laeuft}
            placeholder="Schreib hier, was du gefunden hast."
            className="w-full resize-y rounded-(--radius-lg) border border-line bg-raised px-4 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-3 focus-visible:border-accent"
          />
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={abgeben}
              disabled={laeuft || loesung.trim().length < 20}
              className={cn(KNOPF, "bg-accent text-accent-on hover:opacity-90")}
            >
              {laeuft && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
              {laeuft ? "Wird geprüft …" : "Abgeben"}
            </button>
            <span className="text-2xs leading-relaxed text-ink-3">
              Niemand sieht zu, und die Zeit wird nicht erzwungen. Das steht später auch im
              Zeugnis — sonst wäre es eine Fälschung.
            </span>
          </div>
        </section>
      )}

      {lage?.art === "kein_modell" && (
        <section className="rounded-(--radius-lg) border border-line bg-raised p-5">
          <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
            Die Prüfung ist gerade nicht erreichbar. Deine Lösung steht noch da — versuch es gleich
            noch einmal.
          </p>
        </section>
      )}

      {lage?.art === "nicht_bewertbar" && (
        <section className="rounded-(--radius-lg) border border-line bg-raised p-5">
          <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
            {lage.grund}
          </p>
        </section>
      )}

      {lage?.art === "nicht_bestanden" && (
        /*
         * Keine Bewertung des Menschen, sondern eine Liste dessen, was
         * fehlte. Und keine Spur: Dieser Versuch wird nirgends
         * festgehalten, auch nicht gezählt.
         */
        <section className="grid gap-3 rounded-(--radius-lg) border border-line bg-raised p-6">
          <h2 className="text-[17px] font-semibold text-ink">
            {lage.getroffen} von {lage.gesamt} Prüfpunkten getroffen
          </h2>
          <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
            Für ein Zeugnis reicht das noch nicht. Diese Punkte fehlten:
          </p>
          <ul className="grid gap-1.5">
            {lage.verfehlt.map((v) => (
              <li key={v} className="flex items-start gap-2 text-[14.5px] text-ink-2">
                <X className="mt-1 size-3.5 shrink-0 text-critical" strokeWidth={2} />
                {v}
              </li>
            ))}
          </ul>
          <p className="max-w-[var(--measure)] border-t border-line pt-3 text-2xs leading-relaxed text-ink-3">
            Dieser Versuch wird nirgends festgehalten — kein Eintrag, keine Zählung. Du kannst es
            jederzeit noch einmal machen, ohne dass es jemand sieht.
          </p>
          <button
            type="button"
            onClick={() => setLage(null)}
            className={cn(KNOPF, "w-fit border border-line text-ink hover:bg-soft")}
          >
            Noch einmal
          </button>
        </section>
      )}

      {lage?.art === "bestanden" && (
        <section className="grid gap-3 rounded-(--radius-lg) border border-accent bg-accent-soft p-6">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold text-ink">
            <Check className="size-5 shrink-0 text-accent-text" strokeWidth={2.2} />
            Nachweis ausgestellt
          </h2>
          <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
            {lage.ergebnis}
          </p>

          {lage.nachweisId ? (
            <p className="max-w-[var(--measure)] text-[14px] leading-relaxed text-ink-2">
              Der Nachweis liegt bei deinen Unterlagen. Ob du ihn weitergibst, entscheidest du —
              er ist erst sichtbar, wenn du ihn freigibst.
            </p>
          ) : (
            /*
             * Das Ergebnis steht, der Nachweis nicht. Das
             * auseinanderzuhalten ist wichtiger, als es aussieht: Wer
             * gleich sagt, es sei gespeichert, und es ist es nicht,
             * verliert das Vertrauen genau dann, wenn jemand den
             * Nachweis braucht.
             */
            <p className="max-w-[var(--measure)] text-[14px] leading-relaxed text-critical">
              Das Ergebnis steht — der Nachweis liess sich gerade nicht ablegen. Versuch es später
              noch einmal, dann wird er ausgestellt.
            </p>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/app/bruecke"
              className={cn(KNOPF, "border border-line text-ink hover:bg-soft")}
            >
              Zurück zur Liste
            </Link>
            <Link
              href={`/app/jobs/${jobId}`}
              className={cn(KNOPF, "bg-accent text-accent-on hover:opacity-90")}
            >
              Die Stelle ansehen
            </Link>
          </div>
        </section>
      )}

      {lage && lage.art !== "kein_modell" && lage.art !== "nicht_bewertbar" && (
        /*
         * Die Prüfpunkte — erst jetzt.
         *
         * Vorher wären sie die Lösung gewesen. Jetzt sind sie die
         * Rechnung: Wer sieht, woran gemessen wurde, kann
         * widersprechen. Ein Widerspruch, den es geben kann, ist der
         * Grund, warum man dem Ergebnis glaubt.
         */
        <section className="grid gap-2.5 border-t border-line pt-5">
          <h2 className="text-[15px] font-semibold text-ink">Woran gemessen wurde</h2>
          <ul className="grid gap-2">
            {aufgabe.pruefpunkte.map((p) => (
              <li key={p.was} className="grid gap-0.5">
                <span className="text-[14.5px] text-ink">{p.was}</span>
                <span className="text-2xs text-ink-3">erwartet: {p.erwartet}</span>
              </li>
            ))}
          </ul>
          <p className="max-w-[var(--measure)] pt-1 text-2xs leading-relaxed text-ink-3">
            Wenn du meinst, dass ein Punkt zu Unrecht als verfehlt gilt, sag es Monday. Eine
            Bewertung, der man nicht widersprechen kann, ist keine.
          </p>
        </section>
      )}
    </div>
  );
}
