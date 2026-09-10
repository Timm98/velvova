"use client";

import { useState, useTransition } from "react";
import { bewerbungsstandMelden, type Stand } from "@/lib/bewerbungsstand";

/**
 * „Hast du die Bewerbung abgeschickt?"
 *
 * Die einzige Stelle, an der der Status auf „gesendet" springen kann.
 * Ein Redirect sagt darüber nichts aus: das Produkt weiss nach dem
 * Öffnen der Originalseite genau so viel wie vorher.
 *
 * Deshalb wird gefragt — und „noch nicht" ist eine ebenso gültige
 * Antwort wie „ja". Ohne diese Möglichkeit wäre die Frage eine
 * Aufforderung.
 *
 * ── Was hier vorher stand ───────────────────────────────────────
 *
 * `void jobId;` — die Antwort lag in `useState` und ging nirgendwohin.
 * Auf jeden Klick erschien „Notiert.", und notiert wurde nichts. Die
 * Bewerbung blieb in „In Vorbereitung", und wer später auf seine
 * Liste sah, hielt sich selbst für vergesslich.
 *
 * Das war kein fehlendes Feature, sondern ein simulierter
 * Erfolgszustand — die Art Fehler, die man nicht sieht, weil sie wie
 * ein Erfolg aussieht.
 */

const ANTWORTEN = [
  { key: "sent", label: "Ja, abgeschickt" },
  { key: "not_yet", label: "Noch nicht" },
  { key: "aborted", label: "Abgebrochen" },
  { key: "later", label: "Später" },
] as const;

export function HandoffConfirm({
  jobId,
  assistantName,
}: {
  jobId: string;
  assistantName: string;
}) {
  const [gewaehlt, setGewaehlt] = useState<Stand | null>(null);
  const [fehler, setFehler] = useState(false);
  const [laeuft, uebergang] = useTransition();

  function melden(stand: Stand) {
    /*
     * Erst anzeigen, dann schreiben.
     *
     * Die Antwort ist eine Angabe des Menschen und keine Berechnung —
     * sie umgehend zu zeigen ist richtig. Scheitert das Schreiben,
     * sagt die Zeile darunter es; sie behauptet dann nicht mehr,
     * etwas sei notiert.
     */
    setGewaehlt(stand);
    setFehler(false);
    uebergang(async () => {
      const a = await bewerbungsstandMelden(jobId, stand);
      if (!a.ok) setFehler(true);
    });
  }

  return (
    <section className="grid gap-3 border-t border-line pt-6">
      <h2 className="text-base font-semibold">Wenn du zurück bist</h2>
      <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
        {assistantName} trägt den Stand nur ein, wenn du ihn bestätigst. Nichts hier zählt eine
        Bewerbung, die du vielleicht gar nicht abgeschickt hast.
      </p>

      <div className="flex flex-wrap gap-2.5" role="group" aria-label="Stand der Bewerbung">
        {ANTWORTEN.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => melden(a.key)}
            aria-pressed={gewaehlt === a.key}
            disabled={laeuft}
            className={`inline-flex min-h-10 items-center rounded-(--radius-full) border px-4 text-sm transition-colors ${
              gewaehlt === a.key
                ? "border-accent bg-accent-soft text-accent-text"
                : "border-line-2 text-ink-2"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {gewaehlt && !fehler && (
        <p className="text-xs leading-relaxed text-ink-3">
          {laeuft
            ? "Wird eingetragen …"
            : gewaehlt === "sent"
              ? "Eingetragen. Wir erinnern dich, wenn ein Nachfassen sinnvoll wird — vorher nicht."
              : gewaehlt === "aborted"
                ? "Eingetragen. Die Stelle bleibt gespeichert, falls du zurückkommst."
                : "Eingetragen. Die Bewerbung bleibt vorbereitet, du kannst jederzeit weitermachen."}
        </p>
      )}

      {fehler && (
        /* Kein „Notiert." über einem fehlgeschlagenen Schreibvorgang.
           Genau diese Verwechslung war der Fehler zuvor. */
        <p className="text-xs leading-relaxed text-critical">
          Das liess sich gerade nicht eintragen. Du kannst den Stand auf der Bewerbungsseite
          setzen.
        </p>
      )}
    </section>
  );
}
