"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, Globe, Loader2, Mic, Paperclip, PanelRightClose, PanelRightOpen, Square } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Angabe } from "@/lib/arbeitgeber/onboarding/bewertung";
import { bewerte } from "@/lib/arbeitgeber/onboarding/bewertung";
import { Freigaben } from "./Freigaben";
import { Vorschau } from "./Vorschau";
import { dokumentLesen, websiteLesen, zugSenden } from "./aktionen";
import { useDiktat } from "./useDiktat";

/**
 * Das Onboarding als Gespräch.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Vorschau daneben steht und nicht danach kommt
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Formular fragt und zeigt am Ende das Ergebnis. Dann ist die
 * Korrektur ein zweiter Durchgang, und den macht kaum jemand.
 *
 * Hier verändert sich rechts etwas, während links geredet wird. Wer
 * sieht, dass aus „möglichst SAP“ ein Wunsch geworden ist und kein
 * Muss, widerspricht sofort — oder eben nicht, und dann stimmt es.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum auf dem Telefon eine Schublade
 * ══════════════════════════════════════════════════════════════
 *
 * Nebeneinander gibt es dort nicht. Untereinander hiesse: Die
 * Vorschau steht unter dem Verlauf und wird nie gesehen, weil der
 * Verlauf wächst. Die Leiste am unteren Rand bleibt sichtbar und
 * trägt die Zahl, um die es geht; wer mehr will, zieht sie auf.
 */

export type Nachricht = {
  rolle: "nina" | "mensch";
  text: string;
};

export function Gespraech({
  startVerlauf,
  startAngaben,
  startFrage,
}: {
  startVerlauf: Nachricht[];
  startAngaben: Angabe[];
  startFrage: string;
}) {
  const [verlauf, setVerlauf] = useState<Nachricht[]>(() =>
    startVerlauf.length > 0 ? startVerlauf : [{ rolle: "nina", text: startFrage }],
  );
  const [angaben, setAngaben] = useState(startAngaben);
  const [entwurf, setEntwurf] = useState("");
  const [laeuft, start] = useTransition();
  const [schubladeOffen, setSchubladeOffen] = useState(false);
  const [spalteOffen, setSpalteOffen] = useState(true);

  const [adresse, setAdresse] = useState("");
  const [adresseOffen, setAdresseOffen] = useState(false);
  /* Der Wortlaut aus dem Mikrofon, bevor jemand daran getippt hat.
     Er wird mitgespeichert: Wenn die Extraktion später etwas falsch
     gelesen hat, ist das der einzige Ort, an dem steht, was wirklich
     gesagt wurde. */
  const [transkriptRoh, setTranskriptRoh] = useState<string | null>(null);

  const ende = useRef<HTMLDivElement>(null);
  const feld = useRef<HTMLTextAreaElement>(null);
  const datei = useRef<HTMLInputElement>(null);

  /*
   * Das Diktat hängt Abschnitte an, statt das Feld zu ersetzen.
   *
   * Wer erst tippt und dann weiterspricht, verlöre sonst das
   * Getippte — und wer zwischen zwei Sätzen Luft holt, den ersten.
   */
  const diktat = useDiktat({
    aufAbschnitt: (text) => {
      setEntwurf((e) => (e.trim().length === 0 ? text : `${e.trim()} ${text}`));
      setTranskriptRoh((r) => (r ? `${r} ${text}` : text));
    },
  });

  useEffect(() => {
    ende.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [verlauf, laeuft]);

  /* Das Textfeld wächst mit. Eine feste Höhe verschluckt bei einer
     langen Antwort den Anfang, und genau lange Antworten sind hier
     das Ziel. */
  useEffect(() => {
    const el = feld.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [entwurf]);

  const senden = () => {
    const text = entwurf.trim();
    if (text.length === 0 || laeuft) return;

    /* Sofort anzeigen, was getippt wurde. Auf die Antwort zu warten,
       bevor der eigene Satz erscheint, fühlt sich an wie ein Verlust. */
    setVerlauf((v) => [...v, { rolle: "mensch", text }]);
    setEntwurf("");

    const roh = transkriptRoh;
    setTranskriptRoh(null);

    start(async () => {
      const e = await zugSenden({ text, transkriptRoh: roh });
      setAngaben(e.angaben);
      setVerlauf((v) => [
        ...v,
        { rolle: "nina", text: e.quittung ? `${e.quittung}\n\n${e.nina.text}` : e.nina.text },
      ]);
    });
  };

  /** Eine Antwort aus einer anderen Quelle in den Verlauf hängen. */
  const quelleMelden = (e: { ok: boolean; text: string; angaben: Angabe[] }) => {
    if (e.angaben.length > 0) setAngaben(e.angaben);
    setVerlauf((v) => [...v, { rolle: "nina", text: e.text }]);
  };

  const websiteSenden = () => {
    const a = adresse.trim();
    if (a.length === 0 || laeuft) return;
    setVerlauf((v) => [...v, { rolle: "mensch", text: `Lies bitte ${a}` }]);
    setAdresse("");
    setAdresseOffen(false);
    start(async () => quelleMelden(await websiteLesen(a)));
  };

  const dateiSenden = (f: File) => {
    setVerlauf((v) => [...v, { rolle: "mensch", text: `Hier ist „${f.name}“.` }]);
    const formular = new FormData();
    formular.set("datei", f);
    start(async () => quelleMelden(await dokumentLesen(formular)));
  };

  /* Die Zahl auf der Schubladenleiste: die Anzeige, weil sie das ist,
     worauf das Gespräch zuläuft. */
  const anzeige = bewerte("anzeige", angaben);

  return (
    <div className="grid gap-4">
    <div className="grid gap-4 lg:grid-cols-[1fr_380px] lg:items-start">
      {/* ── Links: der Verlauf ─────────────────────────────── */}
      <div className="grid min-h-[60vh] content-between gap-4 rounded-[12px] border border-line-3 bg-surface p-4 lg:min-h-[calc(100vh-13rem)]">
        <div className="grid content-start gap-4 overflow-y-auto">
          {verlauf.map((n, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-[10px] px-3 py-2 text-sm",
                n.rolle === "nina"
                  ? "bg-inset text-ink"
                  : "justify-self-end bg-accent text-accent-on",
              )}
            >
              {n.text}
            </div>
          ))}
          {laeuft && (
            <div className="flex items-center gap-2 text-2xs text-ink-3">
              <Loader2 className="h-3 w-3 animate-spin" />
              Monday liest mit
            </div>
          )}
          <div ref={ende} />
        </div>

        {/* ── Die Eingabe ──────────────────────────────────── */}
        <div className="grid gap-2">
          {/* Die Adresszeile klappt auf, statt dauerhaft dazustehen.
              Sie wird einmal je Gespräch gebraucht. */}
          {adresseOffen && (
            <div className="flex items-center gap-2 rounded-[10px] border border-line bg-inset px-3 py-2">
              <Globe className="h-4 w-4 shrink-0 text-ink-3" />
              <input
                type="url"
                inputMode="url"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); websiteSenden(); }
                  if (e.key === "Escape") setAdresseOffen(false);
                }}
                placeholder="https://euer-unternehmen.de/karriere"
                aria-label="Adresse eurer Website"
                className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
                autoFocus
              />
              <button
                type="button" onClick={websiteSenden} disabled={laeuft || adresse.trim().length === 0}
                className="rounded-[6px] bg-accent px-2.5 py-1 text-2xs font-600 text-accent-on disabled:opacity-40"
              >
                Lesen
              </button>
            </div>
          )}

          {diktat.zustand === "hört" && (
            <p className="flex items-center gap-2 px-1 text-2xs text-ink-3">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-critical" />
              {diktat.teiltext.length > 0 ? diktat.teiltext : "Ich höre zu."}
            </p>
          )}
          {diktat.fehler && <p className="px-1 text-2xs text-critical-text">{diktat.fehler}</p>}

          <div className="flex items-end gap-2 rounded-[10px] border border-line bg-surface px-3 py-2">
            <textarea
              ref={feld}
              value={entwurf}
              onChange={(e) => setEntwurf(e.target.value)}
              onKeyDown={(e) => {
                /* Enter sendet, Umschalt+Enter macht eine Zeile. Die
                   umgekehrte Belegung kostet bei jeder kurzen Antwort
                   einen Griff zur Maus. */
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  senden();
                }
              }}
              rows={1}
              placeholder="Erzähl von der Stelle…"
              aria-label="Deine Antwort"
              className="max-h-[200px] flex-1 resize-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
            />
            {/* Datei: das Feld ist unsichtbar, der Knopf löst es aus.
                Ein sichtbares `input[type=file]` sieht auf jedem
                Browser anders aus und lässt sich nicht beschriften. */}
            <input
              ref={datei}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) dateiSenden(f);
                e.target.value = "";
              }}
            />
            <button
              type="button" onClick={() => datei.current?.click()} disabled={laeuft}
              aria-label="Dokument anhängen" title="Stellenbeschreibung, altes Inserat, Organigramm"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-ink-3 hover:bg-soft hover:text-ink disabled:opacity-40"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <button
              type="button" onClick={() => setAdresseOffen((o) => !o)} disabled={laeuft}
              aria-label="Website lesen lassen" aria-expanded={adresseOffen}
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-[8px] hover:bg-soft hover:text-ink disabled:opacity-40",
                adresseOffen ? "text-ink" : "text-ink-3",
              )}
            >
              <Globe className="h-4 w-4" />
            </button>

            {diktat.möglich && (
              <button
                type="button"
                onClick={diktat.zustand === "hört" || diktat.zustand === "verbindet" ? diktat.beenden : diktat.starten}
                aria-label={diktat.zustand === "hört" ? "Diktat beenden" : "Diktieren"}
                aria-pressed={diktat.zustand === "hört"}
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-[8px]",
                  diktat.zustand === "hört"
                    ? "bg-critical-soft text-critical-text"
                    : "text-ink-3 hover:bg-soft hover:text-ink",
                )}
              >
                {diktat.zustand === "hört" ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={senden}
              disabled={laeuft || entwurf.trim().length === 0}
              aria-label="Senden"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-accent text-accent-on disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
          <p className="text-2xs text-ink-3">
            Schreib oder sprich in ganzen Sätzen. Je mehr du am Stück erzählst, desto weniger frage ich nach.
          </p>
        </div>
      </div>

      {/* ── Rechts: die Vorschau (ab lg) ───────────────────── */}
      <aside className={cn("hidden lg:sticky lg:top-24 lg:block", !spalteOffen && "lg:hidden")}>
        <Vorschau angaben={angaben} aufFrisch={setAngaben} />
      </aside>

      {/* Der Schalter zum Zuklappen — für den Fall, dass jemand nur
          reden will. Die Vorschau verschwindet dann, die Daten nicht. */}
      <button
        type="button"
        onClick={() => setSpalteOffen((o) => !o)}
        className="fixed bottom-6 right-6 hidden h-9 w-9 place-items-center rounded-full border border-line-3 bg-surface text-ink-3 shadow-sm hover:text-ink lg:grid"
        aria-label={spalteOffen ? "Vorschau ausblenden" : "Vorschau einblenden"}
      >
        {spalteOffen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
      </button>

      {/* ── Telefon: die Schublade ─────────────────────────── */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setSchubladeOffen((o) => !o)}
          aria-expanded={schubladeOffen}
          className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-line bg-surface px-4 py-3 text-left"
        >
          <span className="text-sm text-ink">Was daraus wird</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-sm font-600 tabular-nums text-ink">{anzeige.prozent} %</span>
            <span className="text-2xs text-ink-3">{schubladeOffen ? "schliessen" : "ansehen"}</span>
          </span>
        </button>

        {schubladeOffen && (
          <div className="fixed inset-x-0 bottom-[3.25rem] top-16 z-20 overflow-y-auto border-t border-line bg-surface px-4 py-4">
            <Vorschau angaben={angaben} aufFrisch={setAngaben} />
          </div>
        )}
        {/* Platz, damit die Leiste nicht auf der Eingabe liegt. */}
        <div className="h-14" aria-hidden="true" />
      </div>
    </div>

    {/*
      Die Freigaben stehen unter dem Gespräch und nicht darin.

      Sie sind keine Frage, die Monday stellt — sie sind eine
      Entscheidung über fremde Daten, und die trifft man mit den Augen
      auf der Folgenliste, nicht im Vorbeireden.
    */}
    <Freigaben angaben={angaben} aufFrisch={setAngaben} />
    </div>
  );
}
