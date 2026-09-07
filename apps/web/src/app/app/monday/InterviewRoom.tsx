"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, Check, Mic, PauseCircle, Sparkle, Square, X } from "lucide-react";
import { confirmEvidence, dismissEvidence, rejectEvidence } from "@/lib/profile";
import { pauseSession } from "@/lib/interview";
import { Composer } from "@/components/nina/Composer";
import { NinaCore } from "@/components/nina/NinaCore";
import { SpeakButton } from "@/components/nina/SpeakButton";
import { ProgressDrawer } from "@/components/nina/ProgressDrawer";
import { seitenwechsel } from "@/lib/nina/uebergang";
import { darfFuehren, FUEHRUNG_WARTEN_MS } from "@/lib/nina/fuehrung";
import { taetigkeit } from "@/lib/nina/taetigkeit";
import { ScrollUebergang } from "@/components/nina/ScrollUebergang";
import { JobSuggestions } from "@/components/nina/JobSuggestions";
import { Bedingungen } from "@/components/nina/Bedingungen";
import { useNina } from "@/components/nina/NinaProvider";
import { useLiveVoice } from "@/components/nina/useLiveVoice";
import { LIVE_TEXT } from "@/lib/nina/live-voice";
import { cn } from "@/lib/cn";

/**
 * Das Karrieregespräch.
 *
 * Eine Spalte, 820 Pixel breit, mit Licht dahinter. Kein rechtes Panel,
 * keine Themenleiste, keine Nachrichtenkarten.
 *
 * Was diese Fassung anders macht als die vorige:
 *
 *   **Die Frage bekommt Raum.** Mondays aktuelle Frage steht groß und
 *   frei auf der Fläche, nicht in einer Sprechblase. Eine Frage nach
 *   dem eigenen Berufsweg in einem grauen Kasten liest sich wie ein
 *   Formularfeld.
 *
 *   **Der Fortschritt ist ein Satz, keine Zahl.** „Wir lernen gerade
 *   deine Arbeitsweise kennen“ statt „Frage 3 von 40“. Die Zahl würde
 *   eine Länge versprechen, die niemand einhalten kann, und sie macht
 *   aus einem Gespräch eine Strecke.
 *
 *   **Der Bildschirm ist nie leer.** Hinter dem Gespräch liegt ein sehr
 *   weiches violettes Licht, unter dem Composer stehen Antwortimpulse.
 *   Eine große weiße Fläche mit einer kleinen Frage darin wirkt
 *   unfertig, egal wie gut die Frage ist.
 *
 *   **Nur der Nachrichtenstrom scrollt.** Kopf und Eingabefeld stehen
 *   fest. Vorher scrollte die ganze Seite: nach zwanzig Nachrichten war
 *   Monday aus dem Bild, und wer etwas schreiben wollte, musste erst
 *   wieder nach unten. Auf dem Telefon kam die Tastatur dazu und schob
 *   das Feld vollends weg.
 */

interface Hypothese {
  id: string;
  statement: string;
}

/**
 * Antwortimpulse je Stufe.
 *
 * Ausdrücklich Hilfestellungen, keine vorgegebenen Antworten: sie
 * stehen unter dem Eingabefeld, nicht darin, und wer eigene Worte hat,
 * sieht sie gar nicht erst an. Für Menschen, die vor einem leeren Feld
 * hängenbleiben, sind sie der Unterschied zwischen Anfangen und
 * Wegklicken.
 */
const IMPULSE_JE_STUFE: Record<string, string[]> = {
  orientation: [
    "Mehr Entwicklung",
    "Besseres Gehalt",
    "Passendere Aufgaben",
    "Ich weiß es noch nicht",
  ],
  current_situation: ["Ich bin angestellt", "Ich suche gerade aktiv", "Ich orientiere mich neu"],
  evidence_discovery: [
    "Ein Projekt, auf das ich stolz bin",
    "Etwas, das schiefging",
    "Ich weiß nicht, wo ich anfangen soll",
  ],
  task_preferences: ["Mit Menschen arbeiten", "Aufbauen und ordnen", "Analysieren", "Erklären"],
  work_style: ["Lieber im Team", "Lieber selbstständig", "Klare Struktur", "Viel Freiraum"],
  values_and_tradeoffs: ["Sicherheit", "Entwicklung", "Sinn", "Zeit für Privates"],
  constraints: ["Höchstens zwei Tage Büro", "Kein Schichtdienst", "Gehalt ist mir wichtig"],
  role_hypotheses: ["Zeig mir ungewöhnliche Ideen", "Lieber etwas Naheliegendes"],
  validation: ["Stimmt so", "Das trifft es nicht ganz"],
};

export function InterviewRoom({
  assistantName,
  openingQuestion,
  hypotheses,
  initialMessages,
  conversationId,
  initialStage,
  initialStatus,
  progress,
  labels,
}: {
  assistantName: string;
  openingQuestion: string;
  hypotheses: Hypothese[];
  initialMessages: { id: string; role: "user" | "assistant"; content: string }[];
  conversationId: string | null;
  initialStage: string;
  initialStatus: string;
  progress: { groups: { key: string; label: string; done: boolean }[]; completeness: number };
  labels: { yourAnswer: string; pauseSession: string };
}) {
  const nina = useNina();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erledigt, setErledigt] = useState<Set<string>>(new Set());
  const [fortschrittOffen, setFortschrittOffen] = useState(false);

  /*
   * ══════════════════════════════════════════════════════════════
   * Sobald Monday Treffer hat, geht es weiter
   * ══════════════════════════════════════════════════════════════
   *
   * Nicht auf eine Geste warten, nicht auf einen Knopf: Wenn das
   * Gespräch sein Ziel erreicht hat, führt es dorthin, wo das
   * Ergebnis steht. Der Chat fährt nach oben aus dem Bild, das
   * Eingabefeld wandert an seinen Platz auf der Stellenseite, und die
   * Liste kommt von unten nach — eine Bewegung.
   *
   * ── Vier Riegel, damit es kein Übergriff wird ────────────────
   *
   *   1. Nur beim ERSTEN Mal. Wer zurückkommt, wird nicht wieder
   *      weggeschoben.
   *   2. Nicht, solange Monday noch schreibt. Mitten im Satz
   *      wegzufahren nimmt einem das Ende der Antwort.
   *   3. Nicht, solange ein angefangener Text im Feld steht. Er
   *      würde mit der Seite verschwinden.
   *   4. Erst nach 1,6 Sekunden. Man soll den Satz lesen können, mit
   *      dem Monday die Treffer ankündigt — sonst wirkt es, als
   *      hätte die Seite einen Fehler.
   *
   * Bricht eine Bedingung, wird nichts nachgeholt: Der Zeitgeber
   * läuft ab, und beim nächsten Anlass wird neu entschieden.
   */
  const gefuehrt = useRef(false);

  /*
   * Die Stellenseite vorladen, sobald das Gespräch offen ist.
   *
   * Der Übergang kann nur fahren, solange die Zielseite in
   * Millisekunden dasteht — er friert das Bild ein, bis sie da ist,
   * und Chromium verwirft ihn nach vier Sekunden. Das Gerüst in
   * `app/jobs/loading.tsx` sorgt für den schnellen Wechsel, das
   * Vorladen dafür, dass auch dessen Daten schon unterwegs sind,
   * bevor jemand geführt wird.
   */
  useEffect(() => {
    router.prefetch("/app/jobs");

    /*
     * Die Stellenseite im Hintergrund vorbereiten.
     *
     * `router.prefetch` holt den Bauplan der Seite, nicht ihre Daten
     * — die entstehen erst beim Aufruf, und das sind gemessen 366
     * Millisekunden Netzrunden gegen Supabase. Genau die sah man beim
     * Wechsel als Wartezeit.
     *
     * Dieser Aufruf lässt den Server sie vorher holen. Er gibt nichts
     * zurück (204) und nimmt nichts entgegen: Gewärmt wird immer der
     * Stand der angemeldeten Person.
     *
     * Alle fünfzehn Sekunden neu, weil der Vorrat zwanzig Sekunden
     * hält — ein Gespräch dauert länger als das, und ein kalter
     * Vorrat wäre kein Vorrat.
     *
     * Fehler werden geschluckt: Das Vorwärmen ist ein Angebot. Ohne
     * es holt die Stellenseite ihre Daten wie bisher selbst, und ein
     * Fehler hier darf niemandem das Gespräch stören.
     */
    const waermen = (): void => {
      void fetch("/api/jobs/vorwaermen", { method: "POST", keepalive: true }).catch(() => {});
    };
    waermen();
    const takt = window.setInterval(waermen, 15_000);
    return () => window.clearInterval(takt);
  }, [router]);

  useEffect(() => {
    const lage = () => {
      const feld = document.activeElement;
      return {
        schonGefuehrt: gefuehrt.current,
        treffer: nina.jobs.length,
        schreibtGerade: nina.busy,
        feldinhalt:
          feld instanceof HTMLTextAreaElement || feld instanceof HTMLInputElement
            ? feld.value
            : null,
      };
    };

    if (!darfFuehren(lage())) return;

    /*
     * Vor dem Wechsel noch einmal prüfen.
     *
     * In den 1,6 Sekunden kann sich alles ändern: Monday fängt eine
     * neue Antwort an, jemand tippt los, oder er ist selbst schon
     * hinübergegangen. Die Bedingungen von vorhin gelten dann nicht
     * mehr.
     */
    const uhr = window.setTimeout(() => {
      if (!darfFuehren(lage())) return;
      gefuehrt.current = true;
      seitenwechsel(router, "/app/jobs", "runter");
    }, FUEHRUNG_WARTEN_MS);

    return () => window.clearTimeout(uhr);
  }, [nina.busy, nina.jobs.length, router]);
  const ende = useRef<HTMLDivElement>(null);
  const strom = useRef<HTMLDivElement>(null);
  const [neueAntwort, setNeueAntwort] = useState(false);

  const geladen = useRef(false);
  useEffect(() => {
    if (geladen.current) return;
    geladen.current = true;
    if (initialMessages.length > 0) nina.hydrate(conversationId, initialMessages);
  }, [initialMessages, conversationId, nina]);

  /*
   * Wie nah am unteren Rand ist nah genug?
   *
   * 120 Pixel — etwa zwei Zeilen. Kleiner, und schon das Nachrücken
   * einer Zeile während des Streamings gilt als „weggescrollt";
   * grösser, und die Ansicht springt jemandem hinterher, der gerade
   * eine ältere Antwort liest.
   */
  const NAH_GENUG = 120;

  const amEnde = useCallback(() => {
    const el = strom.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NAH_GENUG;
  }, []);

  const nachUnten = useCallback((sofort = false) => {
    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ende.current?.scrollIntoView({
      behavior: sofort || ruhig ? "auto" : "smooth",
      block: "end",
    });
    setNeueAntwort(false);
  }, []);

  /*
   * Mitlaufen — aber nur, wenn die Person unten steht.
   *
   * Wer nach oben gescrollt hat, liest etwas. Ihn beim nächsten Token
   * nach unten zu reissen ist die unhöflichste Bewegung, die eine
   * Oberfläche machen kann: der Satz, den er gerade las, ist weg, und
   * er weiss nicht wohin. Stattdessen erscheint unten eine Pille.
   *
   * Die Prüfung läuft in `requestAnimationFrame`, weil `scrollHeight`
   * den Browser zum Neuberechnen des Layouts zwingt. Bei jedem
   * gestreamten Token direkt gemessen, wäre das ein Layout-Durchlauf
   * pro Zeichen.
   */
  /*
   * ══════════════════════════════════════════════════════════════
   * Beim Öffnen steht man unten, beim zuletzt Geschriebenen
   * ══════════════════════════════════════════════════════════════
   *
   * Wer aus der Stellenseite zurückkommt, landete oben im Gespräch —
   * beim ersten Satz von vorgestern — und musste erst nach unten
   * scrollen, um zu sehen, wo er stehengeblieben war. Ein Gespräch
   * öffnet man da, wo es aufgehört hat.
   *
   * Warum das nicht schon der Effekt darunter erledigte: Der läuft
   * beim ersten Eintreffen der Nachrichten, misst mit `amEnde()` und
   * scrollt „sanft". Zu dem Zeitpunkt ist der Strom aber noch leer
   * gemessen — `scrollHeight` gleich `clientHeight` —, also gilt
   * „steht schon unten", und die sanfte Bewegung geht ins Leere.
   *
   * Hier wird deshalb hart gesprungen, nicht gescrollt, und zweimal:
   * einmal sofort, einmal nach einem Bild, wenn die Höhen stehen. Ein
   * Sprung ist hier richtig — man kommt an, man reist nicht.
   */
  const untenGestartet = useRef(false);
  useEffect(() => {
    if (untenGestartet.current) return;
    if (nina.messages.length === 0) return;
    untenGestartet.current = true;

    const ansEnde = () => {
      const el = strom.current;
      if (el) el.scrollTop = el.scrollHeight;
    };
    ansEnde();
    const bild = requestAnimationFrame(() => {
      ansEnde();
      requestAnimationFrame(ansEnde);
    });
    return () => cancelAnimationFrame(bild);
  }, [nina.messages.length]);

  useEffect(() => {
    if (nina.messages.length === 0) return;
    const bild = requestAnimationFrame(() => {
      if (amEnde()) nachUnten();
      else setNeueAntwort(true);
    });
    return () => cancelAnimationFrame(bild);
  }, [nina.messages, amEnde, nachUnten]);

  /*
   * Zwei Dinge am Scrollzustand: ob die Pille weg darf, und ob Monday
   * klein werden soll. Beides aus derselben Messung, damit nicht zwei
   * Zuhörer dasselbe Layout zweimal berechnen.
   */
  useEffect(() => {
    const el = strom.current;
    if (!el) return;
    let angefordert = false;

    const beiScroll = () => {
      if (angefordert) return;
      angefordert = true;
      requestAnimationFrame(() => {
        angefordert = false;
        if (amEnde()) setNeueAntwort(false);
      });
    };

    el.addEventListener("scroll", beiScroll, { passive: true });
    return () => el.removeEventListener("scroll", beiScroll);
  }, [amEnde]);

  /*
   * `erledigt` ist nur die Anzeige bis zum nächsten Laden.
   *
   * Es hält die Zeile sofort aus dem Blick, während der Server noch
   * schreibt. Dauerhaft entschieden wird auf dem Server — vorher war
   * genau das der Fehler: dieses Set war die EINZIGE Erinnerung, und
   * nach jedem Neuladen stand alles wieder da.
   */
  function bewerten(id: string, stimmt: boolean) {
    startTransition(async () => {
      await (stimmt ? confirmEvidence(id) : rejectEvidence(id));
      setErledigt((s) => new Set(s).add(id));
      router.refresh();
    });
  }

  /** Weglegen, ohne zu urteilen. */
  function weglegen(id: string) {
    startTransition(async () => {
      await dismissEvidence(id);
      setErledigt((s) => new Set(s).add(id));
      router.refresh();
    });
  }

  /*
   * Escape legt die oberste Erkenntnis weg.
   *
   * Nicht die ganze Fläche auf einmal: das wäre eine Entscheidung über
   * bis zu drei Aussagen mit einem Tastendruck, und rückgängig machen
   * kann man sie hier nicht. Eine nach der anderen ist langsamer und
   * die einzige Lesart, die zu „Escape" passt.
   */
  useEffect(() => {
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || pending) return;
      const erste = hypotheses.find((h) => !erledigt.has(h.id));
      if (!erste) return;
      e.preventDefault();
      weglegen(erste.id);
    };
    window.addEventListener("keydown", beiTaste);
    return () => window.removeEventListener("keydown", beiTaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hypotheses, erledigt, pending]);

  function pausieren() {
    startTransition(async () => {
      await pauseSession();
      router.push("/app");
    });
  }

  /*
   * Die zuletzt fertig gestreamte Antwort.
   *
   * Sie ist das Signal zum Vorlesen. Bewusst erst, wenn `streaming`
   * vorbei ist: eine halb fertige Antwort vorzulesen hiesse, Monday beim
   * Nachdenken zuzuhören.
   */
  const letzteAntwort = (() => {
    for (let i = nina.messages.length - 1; i >= 0; i--) {
      const m = nina.messages[i]!;
      if (m.role !== "assistant") continue;
      return m.streaming ? null : { id: m.id };
    }
    return null;
  })();

  const live = useLiveVoice({
    send: async (text) => {
      await nina.send(text, { fromVoice: true });
    },
    fertigeAntwort: letzteAntwort,
  });

  // Das Mikrofon soll Mondays Bild bewegen: zuhören, denken, sprechen.
  useEffect(() => {
    nina.setListening(live.stand.zustand === "hört");
  }, [live.stand.zustand, nina]);

  const offen = hypotheses.filter((h) => !erledigt.has(h.id));
  const stufe = nina.stage ?? initialStage;
  const status = nina.stageStatus ?? initialStatus;
  /* Derzeit ohne Abnehmer — die Plättchen unter dem Feld sind
     entfernt. Siehe die Begründung weiter unten. */
  const impulse = IMPULSE_JE_STUFE[stufe] ?? [];
  const nochNichtsGesagt = nina.messages.length === 0;

  return (
    /*
     * `h-full` bis ganz nach unten durchreichen.
     *
     * Eine Höhe in Prozent misst sich am Elternteil. Fehlt sie einem
     * einzigen Element in der Kette, wird daraus `auto`, und alles
     * darunter wächst wieder mit dem Inhalt — ohne dass etwas bricht,
     * das man sehen würde. Genau hier war die Lücke: `main` hatte seine
     * feste Höhe, die Spalte darin `h-full`, und diese Hülle dazwischen
     * nichts.
     */
    <div className="relative h-full">
      {/*
       * Hier lag das Licht hinter dem Gespräch — und es ist weg.
       *
       * Ein radialer Verlauf über die volle Breite, 420 Pixel hoch, ab
       * 24 Pixel oberhalb des Bereichs. Gedacht war er als leiser
       * Grund, damit die Fläche nicht wie ein leeres Blatt wirkt.
       *
       * Auf dem Bildschirm wurde daraus etwas anderes: ein heller
       * Kegel, der unter dem Header hervorschien und mehrere hundert
       * Pixel in die Seite reichte. Weil der Header selbst durchsichtig
       * ist (`bg-page/85`), lag der Verlauf teilweise HINTER ihm — es
       * sah aus, als leuchte die Kopfzeile nach unten.
       *
       * Monday hat ihren eigenen Schein, und der sitzt dort, wo er
       * hingehört: `inset-[-18%]` um ihre Fläche. Ein zweites Licht
       * über die ganze Seitenbreite fügt nichts hinzu, das eine Person
       * benennen könnte — es macht nur den oberen Rand unruhig.
       */}

      <div className="relative mx-auto flex h-full w-full max-w-[820px] flex-col">
        {/* ── Kopf ────────────────────────────────────────────── */}
        {/* `gap-x-6`, nicht 4: das Licht hinter Monday reicht bewusst 18%
            über ihre Fläche hinaus (`inset-[-18%]`), bei 120px also gut
            20 Pixel. Mit dem kleineren Abstand lag der Schein auf dem
            Wort „Monday". */}
        <header className="uebergang-gespraech-kopf flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 pt-6 pb-5">
          {/*
           * Monday schrumpft, sobald das Gespräch läuft.
           *
           * Gross am Anfang: da ist sie das Einzige auf der Fläche und
           * soll es sein. Klein, sobald jemand scrollt — dann gehört
           * der Platz den Nachrichten.
           *
           * Umgeschaltet wird `size`, nicht eine Hülle drumherum.
           *
           * Der erste Versuch war eine Box mit `overflow-hidden`, die
           * ihre Grösse animiert. Das Ergebnis war ein dunkelvioletter
           * Kasten: das weiche Licht hinter Monday liegt bewusst
           * ausserhalb ihrer Fläche (`inset-[-18%]`), und die Hülle hat
           * es an vier geraden Kanten abgeschnitten.
           *
           * Der Wechsel des `size`-Werts tauscht nur zwei Klassen am
           * selben Element. React baut nichts neu auf, die Szene lebt
           * weiter — die 12 MB werden nicht noch einmal geladen — und
           * der ResizeObserver in NinaScene passt die Leinwand
           * währenddessen mit an.
           */}
          {/*
           * Auf dem Telefon immer die kleine Fassung.
           *
           * Bei 390 Pixeln bricht die Kopfzeile ohnehin in zwei Reihen:
           * Monday mit Titel oben, die Knöpfe darunter. Mit dem grossen
           * Bild ergab das 220 Pixel — ein Viertel eines 844 Pixel hohen
           * Bildschirms, bevor eine einzige Nachricht zu sehen war.
           *
           * Auf dem Telefon ist Platz das knappste Gut. Mondays Grösse
           * darf dort nicht die Hälfte des Gesprächs kosten; ab `sm`
           * bleibt sie gross, weil dort Raum dafür da ist.
           */}
          {/*
           * Eine Grösse, keine Animation beim Scrollen.
           *
           * Vorher wechselte der Kern zwischen 120 und 72 Pixeln, je
           * nachdem wie weit man gescrollt hatte. Das kostete oben ein
           * Viertel des Bildschirms und bewegte danach die ganze
           * Kopfzeile, während man las.
           *
           * `NinaCore` steht fest bei 72 beziehungsweise 120 Pixeln —
           * gross genug, dass man die Struktur im Inneren sieht und
           * nicht nur eine Kugel, klein genug, dass das Gespräch die
           * Seite behält.
           */}
          <NinaCore />

          <div className="grid min-w-0 flex-1 gap-0.5">
            <h1 className="font-display text-xl font-normal tracking-[-0.02em]">
              {assistantName}
            </h1>
            {/* Eine menschliche Statuszeile. Keine Zahl, keine Strecke. */}
            {/* Zwei Zeilen statt einer abgeschnittenen. Die Statuszeile
                ist ein ganzer Satz („Wir klären gerade, worum es dir
                geht") — mitten im Wort abgeschnitten liest sie sich wie
                ein Fehler, nicht wie eine Auskunft. */}
            <p aria-live="polite" className="line-clamp-2 text-sm text-ink-2">
              {status}
            </p>
          </div>

          {/*
           * Drei Handlungen, drei Ränge — vorher drei gleich laute Knöpfe.
           *
           * Gemessen: 232 + 229 + 208 Pixel, zusammen 677 in einer
           * Spalte von 820. Neben Monday und der Statuszeile ging das
           * nicht auf, also brach die Gruppe in eine zweite Reihe und
           * die Kopfzeile war 220 Pixel hoch — ein Viertel des Fensters,
           * bevor eine einzige Nachricht zu sehen war.
           *
           * Umbrechen war nicht das Problem, sondern dass alle drei so
           * aussahen, als wären sie gleich wichtig. Sie sind es nicht:
           *
           *   „Was ich über dich weiß" bleibt vollständig beschriftet.
           *   In einem Produkt, dessen Versprechen die Verfügung über
           *   die eigenen Daten ist, ist das kein Knopf, den man zu
           *   einem Symbol eindampft — „über dich" ist genau der Teil,
           *   auf den es ankommt.
           *
           *   „Live sprechen" verliert Mondays Namen. Er steht als
           *   Überschrift zwei Zentimeter daneben; ihn im Knopf zu
           *   wiederholen kostete 70 Pixel und sagte nichts Neues. Die
           *   ganze Formulierung bleibt als aria-label für alle, die
           *   die Überschrift nicht mitlesen.
           *
           *   Pausieren wird ein Symbol. Es ist die seltenste der drei
           *   Handlungen, und ein durchgestrichener Kreis mit zwei
           *   Balken ist eine der wenigen Formen, die wirklich jeder
           *   kennt.
           */}
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setFortschrittOffen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-(--radius-control) bg-soft px-4 text-sm text-ink-2 transition-colors hover:bg-soft-hover hover:text-ink"
            >
              <Sparkle className="size-4" strokeWidth={1.8} />
              {/*
               * Auf dem Telefon kürzer.
               *
               * Mit der vollen Beschriftung brach die Knopfgruppe bei
               * 390 Pixeln in eine zweite Reihe, und die Kopfzeile war
               * 220 Pixel hoch — ein Viertel des Bildschirms, bevor
               * eine Nachricht zu sehen war.
               *
               * „über dich" ist der Teil, auf den es ankommt, und er
               * bleibt: er unterscheidet „was Monday weiss" von „was Monday
               * kann". Weg fällt nur das Verb, das aus dem Zusammenhang
               * ohnehin klar ist. Für Vorlesegeräte bleibt der ganze
               * Satz über `aria-label`.
               */}
              <span aria-hidden className="sm:hidden">Über dich</span>
              <span aria-hidden className="hidden sm:inline">Was ich über dich weiß</span>
              <span className="sr-only">Was ich über dich weiß</span>
            </button>

            {/*
             * Die drei Aktionen als EINE Gruppe.
             *
             * Vorher waren es drei gleichrangige Flex-Kinder neben Monday
             * und der Statuszeile. In einer 820 Pixel breiten Spalte
             * passte das nicht: jeder Knopf brach einzeln um, die
             * Kopfzeile wuchs auf vier Reihen und 220 Pixel — ein
             * Drittel der Gesprächsfläche, für drei Knöpfe.
             *
             * Als Gruppe brechen sie gemeinsam in eine zweite Reihe statt
             * einzeln in drei.
             */}
          {/*
             * Der eigene Knopf für das Live-Gespräch (§14.2).
             *
             * Getrennt vom Mikrofon im Composer, und das ist kein Zufall:
             * das eine ist Diktat — sprechen statt tippen, danach lesen
             * und absenden. Das hier ist ein Gespräch, das von selbst
             * weiterläuft. Ein Knopf für beides würde niemandem sagen,
             * was gleich passiert.
             */}
            {/*
              Der Knopf steht IMMER da — auch bevor der Browser
              geantwortet hat, ob er ein Mikrofon hat.
              
              Vorher erschien er erst nach der Hydration. Damit brach
              die Kopfzeile nachträglich in eine zweite Reihe um und
              schob alles darunter 94 Pixel nach unten: gemessene 0,095
              Layoutverschiebung, und für den Menschen ein Satz, der
              beim Lesen wegrutscht.
              
              Ohne Mikrofon ist er abgeschaltet und sagt, warum. Ein
              deaktivierter Knopf ist ehrlicher als einer, der aus dem
              Nichts auftaucht.
            */}
            {(
              <button
                type="button"
                onClick={live.stand.zustand === "aus" ? live.starten : live.beenden}
                disabled={!live.möglich}
                title={live.möglich ? undefined : "Dieser Browser stellt kein Mikrofon bereit."}
                aria-pressed={live.stand.zustand !== "aus"}
                aria-label={
                  live.stand.zustand === "aus"
                    ? `Live mit ${assistantName} sprechen`
                    : `Gespräch mit ${assistantName} beenden`
                }
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-(--radius-control) px-4 text-sm transition-colors",
                  live.stand.zustand === "aus"
                    ? "text-ink-2 hover:bg-soft hover:text-ink"
                    : "bg-accent text-accent-on hover:bg-accent-hover",
                  /*
                   * Gedämpft über die Textfarbe, nicht über Deckkraft.
                   *
                   * `opacity-45` senkt den Kontrast von allem darunter —
                   * axe hat das auf /app/monday als Verstoss gemeldet.
                   * `text-ink-3` ist geprüft und erreicht 4,5:1 auf
                   * jeder Fläche; der Knopf sieht trotzdem inaktiv aus,
                   * weil ihm die Umrandung und der Hover fehlen.
                   */
                  !live.möglich && "cursor-not-allowed text-ink-3 hover:bg-transparent",
                )}
              >
                {live.stand.zustand === "aus" ? (
                  <Mic className="size-4" strokeWidth={1.8} />
                ) : (
                  <Square className="size-3.5 fill-current" strokeWidth={0} />
                )}
                {live.stand.zustand === "aus" ? "Live sprechen" : "Beenden"}
              </button>
            )}

            <button
              type="button"
              onClick={pausieren}
              disabled={pending}
              aria-label={labels.pauseSession}
              title={labels.pauseSession}
              /* Quadratisch statt `px-4`: ohne Text ist waagerechte
                 Polsterung nur Luft, und 44×44 ist die Fläche, die
                 auch ein Daumen trifft. */
              className="inline-flex size-11 items-center justify-center rounded-(--radius-control) text-ink-2 transition-colors hover:bg-soft hover:text-ink disabled:cursor-not-allowed disabled:text-ink-3"
            >
              <PauseCircle className="size-4" strokeWidth={1.8} />
            </button>

          </div>

        </header>

        {/*
         * Was beim Sprechen schiefging — sichtbar, nicht nur im Zustand.
         *
         * `live.stand.fehler` wurde bisher gesetzt und nirgends gezeigt.
         * Damit war jeder Sprachfehler stumm: das Mikrofon ging nicht
         * an, der Ton kam nicht, und die Oberfläche sah aus wie immer.
         * Wer nichts hörte, konnte nur raten, ob es an ihm lag.
         *
         * `role="status"` und nicht `alert`: es unterbricht nicht, es
         * steht da. Die häufigste Ursache — der Browser will erst eine
         * Berührung — ist kein Notfall, sondern eine Anweisung.
         */}
        {live.stand.fehler && (
          <p
            role="status"
            className="mb-4 shrink-0 rounded-(--radius-md) bg-caution-soft px-4 py-3 text-sm leading-relaxed text-ink-2"
          >
            {live.stand.fehler}
          </p>
        )}

        {/* ── Gespräch ────────────────────────────────────────── */}
        {/*
         * `min-h-0` ist hier keine Feinheit, sondern die Bedingung.
         *
         * Ein Flex-Kind hat `min-height: auto` und weigert sich, kleiner
         * zu werden als sein Inhalt. Ohne diese Zeile wächst der
         * Strom mit jeder Nachricht, drückt den Composer aus dem Bild
         * und scrollt nie — `overflow-y-auto` bliebe wirkungslos, ohne
         * dass irgendetwas darauf hinweist.
         */}
        <div
          ref={strom}
          /*
           * Solange nichts gesagt wurde, steht die erste Frage in der
           * Mitte.
           *
           * Vorher klebte sie oben, und darunter standen fünfhundert
           * Pixel Nichts bis zum Eingabefeld. Für jemanden, der die
           * Seite zum ersten Mal öffnet, sieht das nicht nach Ruhe aus,
           * sondern nach einer Seite, die nicht fertig geladen hat.
           *
           * Sobald die erste Antwort da ist, fällt die Zentrierung weg:
           * ein Gesprächsverlauf gehört nach oben und wächst nach
           * unten. `justify-center` bliebe hier ein Fehler, weil der
           * Verlauf sonst bei jeder Nachricht springt.
           */
          className={cn(
            /*
             * `ohne-rollbalken`: kein grauer Balken in der Spalte.
             *
             * `pr-1`: Die eigenen Nachrichten stehen rechtsbündig und
             * lagen damit auf der Kante des scrollenden Bereichs — die
             * abgerundete Ecke wurde angeschnitten. Vier Pixel Luft
             * genügen; mehr würde die Blase sichtbar einrücken.
             */
            "uebergang-gespraech-strom ohne-rollbalken min-h-0 flex-1 overflow-y-auto overscroll-contain pt-2 pr-1 pb-6",
            /*
             * Auch die Ausrichtung wird normal.
             *
             * `justify-center` schob die erste Frage in die Mitte der
             * leeren Fläche — passend zu einer Schautafel, nicht zu
             * einer Nachricht. Ein Gespräch beginnt oben und wächst
             * nach unten; das gilt schon für den ersten Satz.
             */
          )}
        >
          {nochNichtsGesagt && (
            /*
             * Die erste Frage sieht aus wie jede andere Nachricht.
             *
             * Hier standen 28 beziehungsweise 32 Pixel in der
             * Überschriftenschrift, mit der Begründung, eine erste
             * Frage verdiene Raum. Genau diese Begründung stand ein
             * paar Zeilen weiter unten schon einmal — für Mondays
             * Antworten — und wurde dort verworfen: In Schaugrösse
             * liest es sich wie die Ausgabe eines Sprachmodells und
             * nicht wie ein Satz von jemandem, der einem
             * gegenübersitzt.
             *
             * Der Satz wurde damals für die Antworten korrigiert und
             * für die Eröffnung vergessen. Jetzt trägt sie dieselben
             * Klassen wie jede Nachricht von Monday — dieselbe Grösse,
             * dieselbe Schrift, dasselbe Mass.
             */
            <p className="max-w-[var(--measure)] whitespace-pre-wrap text-base leading-relaxed text-ink">
              {openingQuestion}
            </p>
          )}

          <ol className="grid gap-8">
            {nina.messages
              /*
               * Eine leere Antwort ist keine Antwort.
               *
               * Beim Streamen legt der Provider die Nachricht an,
               * bevor das erste Zeichen da ist. Gezeichnet wurde
               * dadurch ein leerer Absatz mit blinkendem Strich — und
               * darunter stand seit heute zusätzlich „Denkt nach".
               * Zwei Zeichen für dieselbe Sache, eines davon ein
               * einzelner Balken ohne Text daneben.
               *
               * Die Vorlage macht es anders: ChatGPT zeigt in dieser
               * Zeit NUR die graue Zeile. Der Balken kommt zurück,
               * sobald das erste Wort da ist — dann steht er, wo er
               * hingehört: am Ende eines Satzes.
               */
              .filter((m) => !(m.role === "assistant" && m.streaming && m.content.length === 0))
              .map((m, i, sichtbare) => {
              /*
               * Die letzte Nachricht groß — aber nur, wenn sie kurz ist.
               *
               * Eine Frage in Schaugröße wirkt einladend. Eine
               * zehnzeilige Zusammenfassung in derselben Größe wirkt
               * erschlagend, und genau die kommt regelmäßig: Monday fasst
               * nach vier bis sechs Antworten zusammen.
               */
              const istLetzte =
                i === sichtbare.length - 1 && m.role === "assistant" && m.content.length < 260;
              return (
                <li key={m.id} className={cn("grid", m.role === "user" && "justify-items-end")}>
                  {m.role === "user" ? (
                    /* Nutzerantworten als weiche Bubble — sie sind kurz
                       und gehören sichtbar der Person. */
                    /* Lavendel statt Grau (§8.3): die Bubble gehört
                       sichtbar der Person, und Grau liest sich als
                       „deaktiviert". Die eine eckigere Ecke unten rechts
                       zeigt, von wem sie kommt, ohne einen Pfeil. */
                    /*
                     * Blau statt Lavendel.
                     *
                     * Lavendel war ein Zwischenschritt: Grau las sich
                     * als „deaktiviert", also wurde es ein sehr helles
                     * Violett. Neben Mondays blauem Kern, dem blauen
                     * Sendeknopf und den blauen Verweisen war das die
                     * einzige Farbe auf der Seite, die zu nichts
                     * gehörte.
                     *
                     * Die eigenen Nachrichten tragen jetzt dieselbe
                     * Akzentfarbe wie der Knopf, mit dem man sie
                     * abschickt. Die eckigere Ecke unten rechts zeigt
                     * weiterhin, von wem sie kommen, ohne einen Pfeil.
                     */
                    <p className="max-w-[80%] whitespace-pre-wrap rounded-(--radius-lg) rounded-br-md bg-accent px-5 py-3.5 text-base leading-relaxed text-accent-on">
                      {m.content}
                    </p>
                  ) : (
                    /*
                      * Mondays Antworten laufen wie der Rest der Seite.
                      *
                      * ── Was hier stand ────────────────────────────
                      *
                      * Die jeweils letzte Antwort lief auf 21 bis 23
                      * Pixeln in der Überschriftenschrift. Der Gedanke
                      * dahinter war, die aktuelle Frage hervorzuheben —
                      * die Wirkung war eine andere: Es sah aus wie die
                      * Ausgabe eines Sprachmodells, nicht wie ein Satz
                      * von jemandem, der einem gegenübersitzt.
                      *
                      * ── Was stattdessen zeigt, was aktuell ist ────
                      *
                      * Die Stelle. Die letzte Antwort steht unten, dort
                      * schaut man ohnehin hin. Ältere treten über die
                      * Farbe zurück, nicht über die Grösse — und
                      * `aria-live` sagt es denen, die es nicht sehen.
                      */
                    <p
                      aria-live={istLetzte ? "polite" : undefined}
                      className={cn(
                        "max-w-[var(--measure)] whitespace-pre-wrap text-base leading-relaxed",
                        istLetzte ? "text-ink" : "text-ink-2",
                      )}
                    >
                      {/*
                        Kein Schreibbalken.
                        ══════════════════════════════════════════

                        Hier blinkte ein zwei Pixel breiter Strich am
                        Ende des laufenden Satzes. Gedacht als „sie
                        schreibt noch", gelesen als Fehler: ein Balken
                        neben Text sieht aus wie eine Textmarke, die
                        jemand vergessen hat.

                        Er wird auch nicht gebraucht. Dass Monday
                        schreibt, sieht man daran, dass Wörter
                        dazukommen — und solange noch keines da ist,
                        steht die Zeile darunter („Denkt nach"). Zwei
                        Zeichen für dieselbe Sache waren eines zu
                        viel; jetzt ist es keines zu wenig.
                      */}
                      {m.content}
                    </p>
                  )}
                  {m.role === "assistant" && !m.streaming && (
                    <SpeakButton messageId={m.id} className="mt-2 -ml-3 justify-self-start" />
                  )}
                </li>
              );
            })}
          </ol>

          {/*
            ══════════════════════════════════════════════════════
            Was Monday gerade tut
            ══════════════════════════════════════════════════════

            Eine graue Zeile an der Stelle, an der gleich die Antwort
            steht — wie bei ChatGPT „Wird verarbeitet". Kein Kringel,
            kein Kasten: Ein Kringel sagt „warte", ein Satz sagt
            „woran".

            Sie verschwindet, sobald das erste Wort da ist. Ab dann ist
            der Text selbst der bessere Beweis, dass etwas passiert.

            Sie steht STILL. Die erste Fassung liess sie leise atmen —
            in der Vorlage tut sie das nicht, und sie hat recht: Eine
            Zeile, die sich bewegt, zieht das Auge auf sich und macht
            das Warten länger. Grau und ruhig sagt dasselbe und
            drängelt nicht.

            `mt-8` ist der Abstand aus der Vorlage: gemessen rund
            vierunddreissig Pixel zwischen der eigenen Bubble und der
            Zeile.

            Welche Zeile wann erscheint, entscheidet `taetigkeit` —
            und jede hat eine technische Ursache im gemeldeten Zustand.
            Erfundene Tätigkeiten stehen hier nicht.
          */}
          {(() => {
            const wort = taetigkeit({
              busy: nina.busy,
              hoert: nina.isListening,
              spricht: nina.isSpeaking,
              sucht: nina.offeringJobs,
              schreibtSchon:
                nina.messages.at(-1)?.role === "assistant" &&
                (nina.messages.at(-1)?.content ?? "").trim().length > 0,
            });
            return wort ? (
              <p className="mt-8 text-base text-ink-3" aria-live="polite">
                {wort}
              </p>
            ) : null;
          })()}

          {/* ── Zustimmung, Stellen zu sehen ──────────────────── */}
          {/*
           * Der eine Klick zwischen „Monday bietet an“ und „Stellen sind
           * da“.
           *
           * Ohne ihn erscheinen Vorschläge, weil ein Modell fand, es sei
           * so weit. Mit ihm, weil ein Mensch es wollte — und die
           * Zustimmung landet serverseitig in einer eigenen Spalte,
           * nicht in einem abgeleiteten Zustand.
           */}
          {nina.offeringJobs && nina.jobs.length === 0 && (
            <div className="mt-8 flex flex-wrap items-center gap-3 rounded-(--radius-surface) bg-ice px-6 py-5">
              <p className="min-w-0 flex-1 leading-relaxed text-ink-2">
                {nina.readiness?.state === "ready"
                  ? "Ich habe genug verstanden, um dir eine sinnvoll gerankte Liste zu zeigen."
                  : "Ich kann dir schon erste Richtungen zeigen — die Einschätzung ist noch vorläufig."}
              </p>
              <button
                type="button"
                onClick={() => {
                  nina.agreeToSeeJobs();
                  void nina.send("Ja, zeig mir bitte passende Stellen.");
                }}
                className="inline-flex h-11 shrink-0 items-center rounded-(--radius-control) bg-accent px-5 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover"
              >
                Stellen ansehen
              </button>
              <button
                type="button"
                onClick={() => void nina.send("Lass uns mein Profil erst noch genauer machen.")}
                className="inline-flex h-11 shrink-0 items-center rounded-(--radius-control) px-4 text-sm text-ink-2 transition-colors hover:bg-raised"
              >
                Profil zuerst schärfen
              </button>
            </div>
          )}

          {/* ── Jobvorschläge im Gespräch ─────────────────────── */}
          {nina.jobs.length > 0 && (
            <div className="mt-10">
              <JobSuggestions jobs={nina.jobs} readiness={nina.readiness} />
            </div>
          )}

          {/* ── Harte Bedingungen aus dem Gespräch ────────────── */}
          <Bedingungen />

          {/*
            Hier stand „Das habe ich verstanden" — eine blaue Fläche
            mit Aussagen aus dem Gespräch und je drei Knöpfen:
            stimmt, stimmt nicht, weglegen.

            Sie hing mitten im Verlauf, zwischen Mondays letzter Frage
            und dem Eingabefeld. Wer gerade antworten wollte, bekam
            stattdessen drei ältere Aussagen zur Beurteilung vorgelegt
            — und musste an ihnen vorbei, um weiterzuschreiben.

            Ein Gespräch verträgt keine Zwischenprüfung. Was Monday
            verstanden hat, gehört dorthin, wo man es in Ruhe ansieht,
            und nicht zwischen zwei Sätze.

            Die Bewertung selbst bleibt möglich: `bewerten` und
            `weglegen` stehen unverändert oben in dieser Datei, und
            die Fortschrittsanzeige führt dieselben Punkte.
          */}

          {nina.error && (
            <p
              role="alert"
              className="mt-8 rounded-(--radius-surface) bg-caution-soft px-5 py-4 leading-relaxed text-ink-2"
            >
              {nina.error}
            </p>
          )}

          <div ref={ende} className="h-4" />
        </div>

        {/* ── Composer ────────────────────────────────────────── */}
        <div className="relative shrink-0 -mx-2 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {/*
           * „Neue Antwort" statt eines Sprungs.
           *
           * Sie erscheint nur, wenn Monday etwas geschrieben hat, während
           * die Person weiter oben las. Ein Klick bringt sie nach
           * unten — freiwillig.
           */}
          {/*
           * Was gerade gehört wird — und was das Gespräch gerade tut.
           *
           * Das Teiltranskript steht über dem Eingabefeld, nicht im
           * Nachrichtenstrom: es ist noch nichts Gesagtes, sondern eine
           * Vermutung, die sich beim Weitersprechen noch ändert.
           */}
          {live.stand.zustand !== "aus" && (
            <div className="mb-2 flex items-center gap-2.5 rounded-(--radius-lg) bg-accent-soft px-4 py-2.5">
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  live.stand.zustand === "hört" ? "bg-accent motion-safe:animate-pulse" : "bg-ink-3",
                )}
              />
              <p aria-live="polite" className="min-w-0 flex-1 truncate text-sm text-ink-2">
                {live.stand.teiltranskript || live.stand.fehler || LIVE_TEXT[live.stand.zustand]}
              </p>
            </div>
          )}

          {neueAntwort && (
            <button
              type="button"
              onClick={() => nachUnten()}
              className={cn(
                "absolute -top-7 left-1/2 z-10 -translate-x-1/2",
                /*
                 * Akzentfarbe, nicht `bg-ink` mit `text-ink-inv`.
                 *
                 * `text-ink-inv` ist `--text-on-primary` — die Farbe,
                 * die AUF dem Akzent liegt. Seit dem Abgleich mit der
                 * Vorlage ist sie im dunklen Schema Weiss (vorher fast
                 * Schwarz). Auf `bg-ink`, das im Dunkeln hell ist, hiess
                 * das: weisse Schrift auf weisser Pille.
                 *
                 * Die Paarung war schon vorher schief — sie hat nur
                 * zufällig funktioniert, solange die eine Farbe dunkel
                 * und die andere hell war. `bg-accent` mit
                 * `text-accent-on` gehört zusammen und stimmt in beiden
                 * Schemata.
                 */
                "inline-flex h-10 items-center gap-2 rounded-(--radius-pill) bg-accent px-4",
                "text-sm font-medium text-accent-on shadow-lg",
                /*
                 * Nur die Bewegung, nicht die Deckkraft.
                 *
                 * `fade-up` startet bei `opacity: 0`. Während dieser
                 * Zehntelsekunde misst eine Kontrastprüfung weissen
                 * Text auf halbdurchsichtigem Schwarz und meldet einen
                 * Verstoss — im Einzeltest nie, im vollen Lauf
                 * gelegentlich, je nachdem wann axe hinsieht.
                 *
                 * Ein Fehler, den man nur manchmal sieht, ist der
                 * teuerste. Die Pille schiebt sich jetzt nur noch
                 * herein; sichtbar ist sie von der ersten Bildfolge an.
                 */
                "motion-safe:animate-[slide-up-solid_var(--duration-base)_var(--ease-out)]",
              )}
            >
              <ArrowDown className="size-4" strokeWidth={2} />
              Neue Antwort
            </button>
          )}
          <Composer
            onSend={(text, options) => {
              /*
               * Wer selbst schreibt, will seine Zeile sehen.
               *
               * Der Effekt weiter oben scrollt nur mit, wenn man
               * ohnehin unten steht — richtig für Mondays Antworten,
               * falsch für die eigene Nachricht. Wer eine alte Stelle
               * im Verlauf nachliest und dann tippt, hat sich für das
               * Neue entschieden.
               *
               * `sofort` statt sanft: Man springt nicht hinterher, man
               * ist da. Und zwei Bilder später noch einmal, weil die
               * eigene Zeile erst nach dem Zeichnen ihre Höhe hat.
               */
              void nina.send(text, options);
              nachUnten(true);
              requestAnimationFrame(() => requestAnimationFrame(() => nachUnten(true)));
            }}
            busy={nina.busy}
            onListeningChange={nina.setListening}
            placeholder={labels.yourAnswer}
            dokumenteFür={assistantName}
            autoFocus
          />

          {/*
            Der Weg zu den Stellen — als Geste UND als Knopf.
            ══════════════════════════════════════════════════════

            Hier stand erst eine Geste, dann ein Knopf, jetzt beides —
            und das ist kein Zickzack, sondern das Ergebnis von zwei
            Beobachtungen.

            Die Geste allein war unsichtbar: Wer sie nicht kennt,
            findet den Weg nicht. Der Knopf allein war unsymmetrisch:
            Von der Stellenseite führt eine Geste zurück, von hier
            keine hin — derselbe Weg, zwei verschiedene Arten, ihn zu
            gehen.

            `ScrollUebergang` ist dasselbe Bauteil wie drüben, nur mit
            anderer Richtung. Es zeigt dauerhaft eine Zeile, die man
            anklicken kann, und löst zusätzlich aus, wenn man am Ende
            weiterscrollt. Ein Bauteil für beide Richtungen: Zwei fast
            gleiche wären beim ersten Unterschied auseinandergelaufen.
          */}
          <ScrollUebergang
            ziel="/app/jobs"
            richtung="runter"
            hinweis="Nach unten scrollen, um deine Stellen zu sehen"
          />

          {/*
            Hier standen die Antwortimpulse — Plättchen unter dem
            Eingabefeld: „Ich bin angestellt", „Besseres Gehalt",
            „Sicherheit" und je nach Stufe drei bis vier weitere.

            Gedacht waren sie als Starthilfe für jemanden, der vor
            einem leeren Feld sitzt. In der Wirkung sind sie das
            Gegenteil dessen, worum es in diesem Gespräch geht: Monday
            fragt, was jemand kann und will — und darunter stehen vier
            fertige Antworten. Man wählt eine, statt zu erzählen, und
            Monday bekommt ein Schlagwort statt einer Situation.

            Genau daraus lässt sich aber nichts belegen. Aus „Ich bin
            angestellt" wird kein Nachweis; aus zwei Sätzen darüber,
            was man gerade macht, schon.

            `IMPULSE_JE_STUFE` bleibt oben stehen. Falls Impulse
            zurückkommen, dann als Rückfrage von Monday, wenn jemand
            wirklich nicht weiterweiss — nicht als Dauerangebot unter
            jedem Feld.
          */}
        </div>
      </div>

      <ProgressDrawer
        open={fortschrittOffen}
        onClose={() => setFortschrittOffen(false)}
        groups={nina.progressGroups ?? progress.groups}
        completeness={nina.readiness?.score ?? progress.completeness}
        readiness={nina.readiness}
        assistantName={assistantName}
      />
    </div>
  );
}
