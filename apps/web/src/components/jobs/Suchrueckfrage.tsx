"use client";

import { createContext, useContext, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, X } from "lucide-react";

/**
 * Ninas eine Rückfrage zur laufenden Suche — unten rechts.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Regel, die dieses Fenster von einem Chat unterscheidet
 * ══════════════════════════════════════════════════════════════
 *
 *   Frage da        → das Fenster öffnet sich
 *   Antwort da      → es schliesst sich
 *   nächste Frage   → es öffnet sich wieder
 *
 * Kein Verlauf, kein Scrollbereich, keine zweite Frage daneben. Wer
 * „Karlsruhe" eintippt, will eine Liste sehen und nicht in ein
 * Gespräch geraten.
 *
 * Das ist auch der Grund, warum die Antwort NICHT in den
 * Gesprächsverlauf wandert: Sie ist eine Einstellung, keine Nachricht.
 * Wer das ganze Gespräch will, öffnet Nina — dafür gibt es die Blase.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Antwort denselben Weg geht wie die Eingabe oben
 * ══════════════════════════════════════════════════════════════
 *
 * „35 km" ist eine Suchzeile wie jede andere. Sie durch dieselbe
 * Deutung zu schicken heisst: eine Auslegung, ein Ergebnis, ein Ort,
 * an dem etwas schiefgehen kann. Eine eigene Antwortlogik daneben
 * wäre eine zweite Auslegung derselben Sprache — und die beiden
 * liefen irgendwann auseinander.
 */

export interface Rueckfrage {
  schluessel: string;
  frage: string;
}

interface Suchdialog {
  frage: Rueckfrage | null;
  /**
   * Eine Frage stellen — oder das Fenster schliessen.
   *
   * Nimmt auch eine Funktion, weil zwei Quellen darum konkurrieren:
   * die eigene Eingabe und der Abruf beim Seitenaufbau. Wer zuerst
   * da ist, gewinnt — und das lässt sich nur entscheiden, wenn man
   * den vorigen Stand sieht.
   */
  stelle: React.Dispatch<React.SetStateAction<Rueckfrage | null>>;
}

const Kontext = createContext<Suchdialog | null>(null);

export function SuchdialogProvider({ children }: { children: React.ReactNode }) {
  const [frage, stelle] = useState<Rueckfrage | null>(null);
  const wert = useMemo(() => ({ frage, stelle }), [frage]);
  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}

export function useSuchdialog(): Suchdialog {
  const k = useContext(Kontext);
  /*
   * Ohne Provider ein stiller Platzhalter statt eines Fehlers.
   *
   * Die Komponente wird auch dort eingebunden, wo es keinen Dialog
   * gibt — und eine Suchzeile, die abstürzt, weil niemand zuhört,
   * wäre der schlechtere Handel.
   */
  return k ?? { frage: null, stelle: () => {} };
}

/**
 * Filter aus der Deutung in die Adresse schreiben.
 *
 * Dieselbe Übersetzung wie oben im Eingabefeld — hier noch einmal,
 * weil die Antwort denselben Weg nimmt.
 */
function adresseMit(
  params: URLSearchParams,
  filter: Record<string, unknown>,
  entfernen: readonly string[],
): string {
  const next = new URLSearchParams(params.toString());
  /* Eine geänderte Bedingung fängt die Liste von vorne an. */
  next.delete("anzahl");
  for (const k of entfernen) next.delete(k);
  for (const [k, v] of Object.entries(filter)) {
    if (v === undefined || v === null || v === "") continue;
    next.set(k, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  return next.toString();
}

export function Suchrueckfrage({ assistantName }: { assistantName: string }) {
  const { frage, stelle } = useSuchdialog();
  const router = useRouter();
  const params = useSearchParams();
  const [text, setText] = useState("");
  const [unterwegs, starte] = useTransition();
  const [laeuft, setLaeuft] = useState(false);

  /*
   * ══════════════════════════════════════════════════════════════
   * Einmal nachsehen, ob eine Frage wartet
   * ══════════════════════════════════════════════════════════════
   *
   * Fragen entstehen nicht nur, während jemand tippt: aus einem
   * Hintergrundlauf, aus einer früheren Sitzung, von einem anderen
   * Gerät. Ohne diesen Abruf lägen sie in der Tabelle und würden nie
   * gestellt.
   *
   * ── Bei jeder Änderung der Adresse, nicht im Takt ───────────
   *
   * Nicht alle paar Sekunden: Eine Frage, die während des Lesens
   * aufpoppt, unterbricht. Aber bei jeder Navigation — denn genau
   * dann hat sich gerade etwas geändert, und die Aufmerksamkeit ist
   * ohnehin bei der Liste.
   *
   * Der Abruf hängt deshalb an der Adresse und nicht an einem
   * einmaligen Merker. Das ist ausserdem robuster: Wenn die
   * Navigation die Komponente neu aufbaut, geht die lokal gesetzte
   * Frage verloren — die auf dem Server nicht.
   */
  const adresse = params.toString();

  useEffect(() => {
    let abgebrochen = false;

    /*
     * ── Warum mit Verzögerung ───────────────────────────────────
     *
     * Das Absenden navigiert zweimal: erst grob aus den Regeln, dann
     * fein aus dem Modell. Ohne Wartezeit liefe der Abruf mitten
     * dazwischen — und zwar bevor die Frage überhaupt geschrieben ist.
     *
     * Vierhundert Millisekunden sind länger als die erste Navigation
     * und kürzer als jede Aufmerksamkeitsspanne.
     */
    const uhr = setTimeout(() => {
      void fetch("/api/jobs/deutung/offen")
        .then((a) => (a.ok ? a.json() : null))
        .then((d: { frage?: Rueckfrage | null } | null) => {
          /* Was gerade aus der eigenen Eingabe kam, hat Vorrang. */
          if (!abgebrochen && d?.frage) stelle((vorher) => vorher ?? d.frage!);
        })
        .catch(() => {});
    }, 400);

    return () => {
      abgebrochen = true;
      clearTimeout(uhr);
    };
  }, [stelle, adresse]);

  if (!frage) return null;

  async function antworten() {
    const inhalt = text.trim();
    if (!inhalt || laeuft) return;
    setLaeuft(true);

    try {
      const bestehend: Record<string, string> = {};
      params.forEach((v, k) => (bestehend[k] = v));

      const antwort = await fetch("/api/jobs/deutung", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eingabe: inhalt,
          bestehend,
          beantwortet: frage!.schluessel,
        }),
      });

      if (antwort.ok) {
        const d = (await antwort.json()) as {
          filter?: Record<string, unknown>;
          entfernen?: string[];
        };
        starte(() =>
          router.replace(
            `/app/jobs?${adresseMit(params, d.filter ?? {}, d.entfernen ?? [])}`,
            { scroll: false },
          ),
        );
      }
    } catch {
      /*
       * Ein Netzfehler schliesst das Fenster trotzdem.
       *
       * Es offen zu lassen hiesse, die Person müsste dieselbe Antwort
       * noch einmal tippen — und zwar ohne zu wissen, ob die erste
       * angekommen ist. Die Frage steht ohnehin serverseitig noch
       * offen und kommt beim nächsten Mal wieder.
       */
    } finally {
      /* Beantwortet heisst zu. Das ist die ganze Regel. */
      setText("");
      setLaeuft(false);
      stelle(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-label={`Rückfrage von ${assistantName}`}
      /*
       * Über der Blase, nicht an ihrer Stelle.
       *
       * Die Blase bleibt der eine Einstieg ins Gespräch. Dieses
       * Fenster ist etwas anderes — eine einzelne Frage mit einer
       * einzelnen Antwort — und legt sich deshalb darüber, statt sie
       * zu ersetzen.
       */
      className="fixed bottom-24 right-5 z-40 w-[min(22rem,calc(100vw-2.5rem))] rounded-(--radius-lg) border border-line bg-raised p-4 shadow-lg"
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink">
          <span className="font-medium">{assistantName}</span> {frage.frage}
        </p>
        <button
          type="button"
          onClick={() => {
            /*
             * Wegklicken ist eine Antwort — nämlich keine.
             *
             * Die Frage bleibt serverseitig offen und kommt beim
             * nächsten Anlass wieder. Sie hier zu schliessen und
             * gleichzeitig als beantwortet zu vermerken wäre eine
             * Zustimmung, die niemand gegeben hat.
             */
            setText("");
            stelle(null);
          }}
          aria-label="Später"
          className="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-(--radius-pill) text-ink-3 transition-colors hover:bg-soft hover:text-ink"
        >
          <X className="size-4" strokeWidth={1.8} />
        </button>
      </div>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void antworten();
        }}
      >
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Antwort …"
          className="h-10 min-w-0 flex-1 rounded-(--radius-pill) border border-line bg-sunken px-3.5 text-sm text-ink outline-none placeholder:text-ink-3 focus-visible:border-line-2"
        />
        <button
          type="submit"
          disabled={text.trim().length === 0 || laeuft || unterwegs}
          className="grid h-10 shrink-0 place-items-center rounded-(--radius-pill) bg-accent px-4 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover disabled:bg-soft disabled:text-ink-3"
        >
          {laeuft || unterwegs ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            "Passt"
          )}
        </button>
      </form>
    </div>
  );
}
