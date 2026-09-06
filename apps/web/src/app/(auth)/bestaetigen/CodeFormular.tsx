"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { codeAnfordern, codePruefen } from "@/lib/arbeitgeber/bestaetigung";
import { cn } from "@/lib/cn";

/**
 * Sechs Felder, ein Code.
 *
 * ── Warum sechs Felder und nicht eines ────────────────────────
 *
 * Ein einzelnes Feld wäre weniger Code und schlechter zu benutzen: Man
 * sieht nicht, wie viele Stellen fehlen, und ein Tippfehler an der
 * dritten Stelle ist nur durch Zählen zu finden.
 *
 * ── Was daran heikel ist ──────────────────────────────────────
 *
 * Sechs Felder brechen drei Dinge, die bei einem Feld
 * selbstverständlich sind — alle drei sind hier wiederhergestellt:
 *
 *   **Einfügen.** Wer den Code aus der Mail kopiert, hat sechs Ziffern
 *   in der Zwischenablage und ein Feld unter dem Zeiger. Ohne
 *   Behandlung landet alles im ersten Feld.
 *
 *   **Löschen.** Die Rücktaste in einem leeren Feld muss ins vorige
 *   springen, sonst steht man fest.
 *
 *   **Automatisches Ausfüllen.** iOS bietet den Code aus der Mail an,
 *   aber nur bei `autocomplete="one-time-code"` am ersten Feld.
 */
export function CodeFormular({
  adresse,
  ziel,
}: {
  /** Die Adresse im Klartext — für „Adresse ändern". */
  adresse: string;
  /** Dieselbe Adresse maskiert. Nur die wird angezeigt. */
  ziel: string;
}) {
  const [code, setCode] = useState("");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [rest, setRest] = useState(0);
  const [maskiert, setMaskiert] = useState(ziel);
  const [klartext, setKlartext] = useState(adresse);
  const [geschafft, setGeschafft] = useState(false);
  const [laeuft, starte] = useTransition();
  const felder = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  /* Der Countdown bis zum erneuten Senden. Nicht nur Höflichkeit:
     Ohne ihn ist „erneut senden" ein Zustellwerkzeug. */
  useEffect(() => {
    if (rest <= 0) return;
    const uhr = setTimeout(() => setRest((r) => r - 1), 1000);
    return () => clearTimeout(uhr);
  }, [rest]);

  const senden = useCallback(
    (neueAdresse?: string) => {
      setFehler(null);
      setMeldung(null);
      starte(async () => {
        const r = await codeAnfordern(neueAdresse);
        if (r.ziel) setMaskiert(r.ziel);
        if (r.ok) setMeldung(r.text);
        else setFehler(r.text);
        setRest(r.wartenBis ?? 0);

        /*
         * Ohne Maildienst kommt der Code in der Antwort zurück — dann
         * wird er gleich eingetragen. Das ist kein Komfort, sondern die
         * einzige Art, die Strecke ohne Postfach zu Ende zu gehen. In
         * der Produktion ist das Feld leer.
         */
        if (r.entwurfsCode) {
          setCode(r.entwurfsCode);
          felder.current[5]?.focus();
        }
      });
    },
    [],
  );

  const pruefen = useCallback(
    (eingabe: string) => {
      if (eingabe.length !== 6 || laeuft || geschafft) return;
      setFehler(null);
      starte(async () => {
        const r = await codePruefen(eingabe);
        if (r.ok) {
          /*
           * Erst die Bestätigung zeigen, dann weiterleiten.
           *
           * Ein sofortiger Sprung sieht aus, als sei etwas
           * schiefgegangen — man tippt die letzte Ziffer und die Seite
           * ist weg. Achthundert Millisekunden reichen, um zu sehen,
           * dass es geklappt hat, und sind kurz genug, dass niemand
           * wartet.
           */
          setGeschafft(true);
          setMeldung(null);
          setTimeout(() => {
            router.refresh();
            /* Wohin, entscheidet der Server: Wer eine Organisation
               hat, gehört in den Arbeitgeberbereich, alle anderen ins
               eigene Onboarding. `/bestaetigen` leitet danach weiter. */
            router.push("/bestaetigen/weiter");
          }, 800);
        } else {
          setFehler(r.text);
          setCode("");
          felder.current[0]?.focus();
        }
      });
    },
    [laeuft, geschafft, router],
  );

  const schreibe = useCallback(
    (neu: string) => {
      const sauber = neu.replace(/\D/g, "").slice(0, 6);
      setCode(sauber);
      if (sauber.length === 6) pruefen(sauber);
      return sauber;
    },
    [pruefen],
  );

  if (geschafft) {
    return (
      <div className="grid justify-items-center gap-4 py-10">
        <span
          aria-hidden
          className="grid size-14 animate-[fade-in_240ms_ease-out] place-items-center rounded-full bg-positive-soft"
        >
          <Check className="size-7 text-positive" strokeWidth={2.4} />
        </span>
        <p role="status" className="text-[15px] font-medium text-ink">
          Adresse bestätigt.
        </p>
        <p className="text-sm text-ink-3">Einen Moment …</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-1.5">
        <p className="text-[15px] text-ink">Wir haben dir einen Code geschickt.</p>
        <p className="text-sm text-ink-3">
          An <span className="font-medium text-ink">{maskiert}</span>
        </p>
      </div>

      {fehler && (
        <p role="alert" aria-live="polite" className="rounded-[10px] border border-critical/40 bg-critical-soft px-4 py-3 text-sm text-ink">
          {fehler}
        </p>
      )}
      {meldung && !fehler && (
        <p role="status" aria-live="polite" className="rounded-[10px] border border-positive/30 bg-positive-soft px-4 py-3 text-sm text-ink-2">
          {meldung}
        </p>
      )}

      <div className="flex justify-between gap-2" role="group" aria-label="Sechsstelliger Code">
        {Array.from({ length: 6 }, (_, i) => (
          <input
            key={i}
            ref={(el) => {
              felder.current[i] = el;
            }}
            value={code[i] ?? ""}
            onChange={(e) => {
              const eingabe = e.target.value.replace(/\D/g, "");
              if (!eingabe) return;
              /* Mehr als eine Ziffer heisst: eingefügt. Dann füllt der
                 ganze Inhalt den Block ab dieser Stelle. */
              const gesetzt = schreibe((code.slice(0, i) + eingabe).slice(0, 6));
              felder.current[Math.min(5, gesetzt.length)]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace") {
                e.preventDefault();
                if (code[i]) {
                  schreibe(code.slice(0, i) + code.slice(i + 1));
                } else if (i > 0) {
                  schreibe(code.slice(0, i - 1) + code.slice(i));
                  felder.current[i - 1]?.focus();
                }
              }
              if (e.key === "ArrowLeft" && i > 0) felder.current[i - 1]?.focus();
              if (e.key === "ArrowRight" && i < 5) felder.current[i + 1]?.focus();
              if (e.key === "Enter") pruefen(code);
            }}
            onPaste={(e) => {
              e.preventDefault();
              const gesetzt = schreibe(e.clipboardData.getData("text"));
              felder.current[Math.min(5, gesetzt.length)]?.focus();
            }}
            disabled={laeuft}
            aria-invalid={fehler ? true : undefined}
            aria-label={`Stelle ${i + 1} von 6`}
            /* `text` mit `inputMode="numeric"`, nicht `type="number"`:
               Letzteres bringt Pfeiltasten mit, die den Wert hoch- und
               runterzählen — bei einem Code sinnlos. `pattern` bringt
               auf iOS den Ziffernblock statt der vollen Tastatur. */
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            className={cn(
              "h-[64px] w-full min-w-0 rounded-[10px] border bg-transparent text-center font-mono text-2xl font-semibold text-ink",
              "transition-[border-color,box-shadow] focus-visible:border-(--primary) focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--primary)]",
              "disabled:cursor-not-allowed disabled:opacity-50",
              fehler ? "border-(--danger)" : "border-line-3",
            )}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => pruefen(code)}
        disabled={laeuft || code.length !== 6}
        className="inline-flex h-[56px] w-full items-center justify-center gap-2 rounded-[10px] bg-accent text-[15px] font-medium text-accent-on transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {laeuft && <Loader2 aria-hidden className="size-4 animate-spin" strokeWidth={2} />}
        {laeuft ? "Wird geprüft …" : "Bestätigen"}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <button
          type="button"
          onClick={() => senden(klartext)}
          disabled={rest > 0 || laeuft}
          className="text-ink-2 underline-offset-[3px] hover:underline disabled:cursor-not-allowed disabled:text-ink-3 disabled:no-underline"
        >
          {rest > 0 ? `Code erneut senden in ${rest} s` : "Code erneut senden"}
        </button>

        {/*
          Die Adresse ändern gehört hierher, nicht in die Einstellungen.

          Wer sich vertippt hat, merkt es genau jetzt — wenn keine Mail
          ankommt. Ihn dafür aus der Strecke zu schicken heisst, dass er
          nicht zurückkommt.
        */}
        <button
          type="button"
          onClick={() => {
            const neu = window.prompt("Neue E-Mail-Adresse", klartext);
            if (!neu?.includes("@")) return;
            const sauber = neu.trim().toLowerCase();
            setKlartext(sauber);
            setCode("");
            senden(sauber);
          }}
          disabled={laeuft}
          className="text-ink-2 underline-offset-[3px] hover:underline"
        >
          E-Mail-Adresse ändern
        </button>
      </div>
    </div>
  );
}
