"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Ein Dokument an Nina geben.
 *
 * Der Knopf ist klein, der Vorgang dahinter ist es nicht: hier wandert
 * ein Lebenslauf oder ein Zeugnis auf einen fremden Server. Deshalb wird
 * VOR dem Hochladen gefragt, wofür es gedacht ist und wie weit es
 * reichen darf — nicht danach in einer Einstellung, die niemand findet.
 *
 * Die Reichweite ist die eigentliche Frage, und die Voreinstellung ist
 * die engste:
 *
 *   **Nur dieses Gespräch** — Nina liest es jetzt, es fliesst nicht ins
 *   Profil. Die Voreinstellung, weil sie am wenigsten voraussetzt.
 *
 *   **Fürs Profil** — die Funde können bestätigt werden und zählen
 *   dann dauerhaft. Eine eigene Entscheidung, kein Häkchen im
 *   Kleingedruckten.
 *
 * Was auch bei „fürs Profil" nicht passiert: nichts wird automatisch
 * übernommen. Was Nina im Dokument findet, ist ein Vorschlag mit
 * Fundstelle — bestätigen muss die Person.
 */

const ARTEN = [
  { key: "cv", label: "Lebenslauf" },
  { key: "cover_letter", label: "Anschreiben" },
  { key: "reference", label: "Zeugnis" },
  { key: "certificate", label: "Zertifikat" },
  { key: "job_ad", label: "Stellenanzeige" },
  { key: "old_application", label: "Alte Bewerbung" },
  { key: "rejection", label: "Absage" },
  { key: "work_sample", label: "Arbeitsprobe" },
  { key: "other", label: "Etwas anderes" },
] as const;

const REICHWEITEN = [
  {
    key: "chat_only",
    label: "Nur dieses Gespräch",
    erklaerung: "Nina liest es jetzt. Es fliesst nicht in dein Profil.",
  },
  {
    key: "career_profile",
    label: "Für mein Profil",
    erklaerung: "Funde kannst du bestätigen — bestätigte zählen dauerhaft.",
  },
] as const;

interface Ergebnis {
  dokumentId?: string;
  gelesen?: boolean;
  seiten?: number | null;
  zeichen?: number;
  behauptungen?: number;
  hinweis?: string;
  schonDa?: boolean;
  fehler?: string;
}

export function DokumentKnopf({
  assistantName,
  onFertig,
}: {
  assistantName: string;
  /** Wird nach erfolgreichem Lesen gerufen — für eine Nachricht im Gespräch. */
  onFertig?: (zusammenfassung: string) => void;
}) {
  const [offen, setOffen] = useState(false);
  const [art, setArt] = useState<string>("cv");
  const [reichweite, setReichweite] = useState<string>("chat_only");
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const feld = useRef<HTMLInputElement>(null);

  async function hochladen(datei: File) {
    setLaeuft(true);
    setErgebnis(null);
    try {
      const form = new FormData();
      form.set("datei", datei);
      form.set("art", art);
      form.set("reichweite", reichweite);

      const antwort = await fetch("/api/nina/documents", { method: "POST", body: form });
      const daten = (await antwort.json()) as Ergebnis;
      setErgebnis(daten);

      if (antwort.ok && daten.gelesen && onFertig) {
        const teile = [
          `Ich habe „${datei.name}" gelesen.`,
          daten.seiten ? `${daten.seiten} Seiten.` : null,
          daten.behauptungen ? `${daten.behauptungen} Angaben gefunden.` : null,
        ].filter(Boolean);
        onFertig(teile.join(" "));
      }
    } catch {
      setErgebnis({ fehler: "Die Datei konnte nicht übertragen werden." });
    } finally {
      setLaeuft(false);
      if (feld.current) feld.current.value = "";
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        aria-expanded={offen}
        aria-label={`Dokument an ${assistantName} geben`}
        title={`Dokument an ${assistantName} geben`}
        className="mb-0.5 grid size-11 shrink-0 place-items-center rounded-(--radius-control) text-ink-2 transition-colors hover:bg-soft hover:text-ink"
      >
        <Paperclip className="size-[18px]" strokeWidth={1.8} />
      </button>

      {offen && (
        <div className="absolute bottom-full right-0 z-30 mb-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-(--radius-surface) border border-line bg-surface p-5 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-base font-semibold">Dokument geben</h3>
            <button
              type="button"
              onClick={() => setOffen(false)}
              aria-label="Schliessen"
              className="grid size-8 place-items-center rounded-(--radius-pill) text-ink-3 hover:bg-soft hover:text-ink"
            >
              <X className="size-4" strokeWidth={1.9} />
            </button>
          </div>

          <div className="mt-4 grid gap-1.5">
            <label htmlFor="dokart" className="text-sm font-medium">
              Was ist das?
            </label>
            <select
              id="dokart"
              value={art}
              onChange={(e) => setArt(e.target.value)}
              className="h-10 rounded-(--radius-sm) border border-line bg-surface px-3 text-sm text-ink"
            >
              {ARTEN.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="mt-4 grid gap-2">
            <legend className="mb-1 text-sm font-medium">Wie weit darf es reichen?</legend>
            {REICHWEITEN.map((r) => (
              <label
                key={r.key}
                className={cn(
                  "grid cursor-pointer gap-0.5 rounded-(--radius-md) px-3.5 py-2.5 transition-colors",
                  reichweite === r.key ? "bg-accent-soft" : "hover:bg-soft",
                )}
              >
                <span className="flex items-center gap-2.5 text-sm font-medium">
                  <input
                    type="radio"
                    name="reichweite"
                    value={r.key}
                    checked={reichweite === r.key}
                    onChange={() => setReichweite(r.key)}
                    className="accent-[var(--accent)]"
                  />
                  {r.label}
                </span>
                <span className="pl-6 text-xs leading-relaxed text-ink-2">{r.erklaerung}</span>
              </label>
            ))}
          </fieldset>

          <p className="mt-3 text-xs leading-relaxed text-ink-3">
            PDF, DOCX oder TXT, höchstens 20 MB. Die Datei bleibt bei dir — sie wird nicht
            veröffentlicht und nicht an Arbeitgeber weitergegeben.
          </p>

          <input
            ref={feld}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void hochladen(f);
            }}
          />

          <button
            type="button"
            onClick={() => feld.current?.click()}
            disabled={laeuft}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-(--radius-pill) bg-accent px-5 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover disabled:opacity-70"
          >
            {laeuft ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                Wird gelesen
              </>
            ) : (
              <>
                <FileText className="size-4" strokeWidth={1.9} />
                Datei auswählen
              </>
            )}
          </button>

          {ergebnis && (
            <div
              role="status"
              className={cn(
                "mt-3 grid gap-1 rounded-(--radius-md) px-3.5 py-3 text-sm leading-relaxed",
                ergebnis.fehler ? "bg-caution-soft text-ink" : "bg-inset text-ink-2",
              )}
            >
              {ergebnis.fehler ? (
                <p>{ergebnis.fehler}</p>
              ) : ergebnis.schonDa ? (
                <p>{ergebnis.hinweis}</p>
              ) : ergebnis.gelesen ? (
                <>
                  <p className="font-medium text-ink">Gelesen.</p>
                  <p>
                    {ergebnis.seiten ? `${ergebnis.seiten} Seiten, ` : ""}
                    {ergebnis.behauptungen ?? 0} Angaben gefunden. Nichts davon zählt, bevor du es
                    bestätigt hast.
                  </p>
                </>
              ) : (
                <p>{ergebnis.hinweis}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
