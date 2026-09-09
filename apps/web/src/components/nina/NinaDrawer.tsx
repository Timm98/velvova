"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Composer } from "./Composer";
import { SpeakButton } from "./SpeakButton";
import { useNina } from "./NinaProvider";

/**
 * Die schwebende Gesprächsfläche.
 *
 * Bewusst kein Modal über der ganzen Seite: Monday ist eine Begleitung,
 * kein Unterbrecher. Auf breiten Geräten sitzt sie unten rechts über
 * dem Inhalt, auf schmalen als Bogen von unten — dort, wo der Daumen
 * ist.
 *
 * Was hier NICHT steht: kein Anbieterhinweis, kein technischer Zustand,
 * keine Kennzeichnung. Läuft Monday, redet sie. Läuft sie nicht, steht da
 * ein Satz und kein Gespräch.
 */

export function NinaDrawer({ assistantName }: { assistantName: string }) {
  const nina = useNina();

  /*
   * ── Nur, was auf DIESER Seite gefragt wurde ─────────────────
   *
   * Monday behält ihr Gedächtnis über Seitenwechsel hinweg — sie muss
   * wissen, worüber vorhin gesprochen wurde, sonst ist „und beim
   * anderen Job?" nicht beantwortbar. Was sie behält, gehört aber
   * nicht auf den Bildschirm: Wer eine neue Seite öffnet, fände unten
   * rechts sonst eine Antwort vor, die zu etwas gehört, das er zwei
   * Klicks vorher gefragt hat.
   *
   * ── Warum nicht über einen Zählerstand ────────────────────
   *
   * Der erste Anlauf merkte sich beim Seitenwechsel die Anzahl der
   * Nachrichten und zeigte nur, was danach dazukam. Das schlug fehl,
   * und zwar auf die unauffällige Art: Beim Einhängen ist der Verlauf
   * noch leer, er wird erst danach vom Server nachgeladen. Die Grenze
   * stand damit auf null, und der ganze nachgeladene Verlauf galt als
   * „auf dieser Seite entstanden".
   *
   * Jetzt hängt es an der Handlung statt an einer Zahl: Angezeigt wird
   * erst, nachdem jemand HIER etwas gefragt hat. Ein nachgeladener
   * Verlauf kann das nicht auslösen, egal wann er eintrifft.
   */
  const pfad = usePathname();

  /*
   * Der Zähler kommt aus dem Provider, nicht aus dieser Fläche.
   *
   * Vorher merkte sie sich selbst, ob hier schon gefragt wurde — und
   * bekam nichts mit, wenn die Frage von woanders kam: aus den
   * Berufsfragen der Stellenanzeige etwa. Die Antwort lief dann, war
   * aber unsichtbar. Genau das sah aus wie „Monday antwortet gar nicht".
   *
   * Jetzt zählt der Provider jedes `send`, und diese Fläche merkt sich
   * beim Seitenwechsel nur den Stand. Was danach dazukommt, gehört
   * hierher.
   */
  const [basis, setBasis] = useState(nina.sendezaehler);
  const gemerkterPfad = useRef(pfad);
  const gefragtHier = nina.sendezaehler > basis;

  useEffect(() => {
    if (gemerkterPfad.current === pfad) return;
    gemerkterPfad.current = pfad;
    setBasis(nina.sendezaehler);
  }, [pfad, nina.sendezaehler]);

  /* Rückwärts gesucht, weil die letzte Nachricht die des Menschen
     sein kann, solange die Antwort noch läuft. */
  const letzteVonNina = gefragtHier
    ? ([...nina.messages].reverse().find((m) => m.role === "assistant") ?? null)
    : null;
  const letzte = gefragtHier ? (nina.messages[nina.messages.length - 1] ?? null) : null;
  const wartetAufAntwort =
    gefragtHier && (letzte?.role === "user" || (nina.busy && !letzteVonNina?.streaming));


  const ende = useRef<HTMLDivElement>(null);
  const fläche = useRef<HTMLDivElement>(null);

  // Ans Ende scrollen, wenn etwas dazukommt. `smooth` nur, wenn niemand
  // reduzierte Bewegung eingestellt hat — sonst ruckt es für genau die
  // Leute, denen Bewegung Beschwerden macht.
  useEffect(() => {
    if (!nina.open) return;
    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ende.current?.scrollIntoView({ behavior: ruhig ? "auto" : "smooth", block: "end" });
  }, [nina.messages, nina.open]);

  // Escape schließt. Eine schwebende Fläche ohne Tastaturausweg ist eine
  // Falle.
  useEffect(() => {
    if (!nina.open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") nina.setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nina.open, nina]);

  // Beim Öffnen den Fokus hineinlegen.
  useEffect(() => {
    if (nina.open) fläche.current?.focus();
  }, [nina.open]);


  if (!nina.open) return null;

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col",
        // Auf schmalen Geräten ein Bogen von unten — dort ist der Daumen.
        "inset-x-0 bottom-0",
        /*
         * Auf breiten Geräten eine kleine Karte über der Blase.
         *
         * Hier stand `sm:inset-y-3` — eine Fläche von rechts über die
         * VOLLE Höhe, mit der Begründung, ein kleines Fenster unten
         * rechts sähe aus wie ein Support-Widget.
         *
         * Der Einwand war richtig für ein Chatfenster mit Verlauf.
         * Seit nur noch Mondays letzte Nachricht darin steht, ist die
         * Fläche zu neunzig Prozent leer — und eine bildschirmhohe
         * leere Spalte für zwei Zeilen Text ist das Gegenteil von
         * dezent. Sie verdeckte ausserdem die rechte Spalte der
         * Stellenseite, also genau das, worüber gesprochen wird.
         *
         * Jetzt sitzt sie direkt über der Blase, 340 Pixel breit, und
         * ihre Höhe folgt dem Inhalt — wie eine Nachricht, nicht wie
         * ein Fenster.
         */
        "sm:inset-x-auto sm:inset-y-auto sm:bottom-16 sm:right-5 sm:w-[340px]",
      )}
      role="dialog"
      aria-modal="false"
      aria-label={`Gespräch mit ${assistantName}`}
    >
      {/*
        Kein Rahmen mehr um alles.
        
        Hier lag eine Karte, die Nachricht und Eingabe zusammen
        einfasste. Damit sah Mondays Antwort aus wie ein Teil des
        Eingabefelds — als hätte man sie selbst hineingeschrieben.
        
        Jetzt sind es zwei getrennte Elemente untereinander: oben die
        Nachricht als eigene Blase, unten die Eingabe. Dieses Element
        ordnet sie nur noch an.
      */}
      <div
        ref={fläche}
        tabIndex={-1}
        className={cn(
          "flex max-h-[85dvh] flex-col justify-end gap-2 outline-none",
          "px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2",
          "sm:max-h-[60dvh] sm:px-0 sm:pb-0",
        )}
      >
        {/*
         * ── Was hier NICHT mehr steht ────────────────────────
         *
         * Ein Kopf: erst Mondays Bild mit Namen und vier Knöpfen, dann
         * Name und Minimieren, dann ein Kreuz. Jetzt nichts. Zwei Wege
         * hinaus bleiben — Escape und ein erneuter Tipp auf die Blase,
         * die umschaltet statt nur zu öffnen.
         *
         * Eine Gesprächsliste: frühere Unterhaltungen zum
         * Wiederöffnen. Genau der Chatverlauf, den das neue Prinzip
         * nicht will. `nina.loadConversation` bleibt im Provider; die
         * Vollbildseite unter `/app/monday` ist der Ort dafür.
         *
         * Stellenvorschläge (`JobSuggestions`): drei Jobkarten in
         * einer 340 Pixel breiten Blase sprengen sie, und Ergebnisse
         * gehören ohnehin auf die Seite, nicht ins Gespräch. Der
         * Baustein bleibt bestehen und wird dort gebraucht, wo Platz
         * für ihn ist.
         */}

        {/*
         * ── Mondays Nachricht als eigene Blase ────────────────
         *
         * Sie steht für sich, mit eigenem Grund und eigenem Rand, und
         * verschwindet, sobald die nächste kommt. `key` an der
         * Nachrichtenkennung sorgt dafür, dass React sie tatsächlich
         * austauscht statt den Text im selben Knoten zu ersetzen —
         * sonst liefe der Übergang nur beim ersten Mal.
         *
         * Der Rollbereich sitzt IN der Blase: Schreibt Monday
         * ausnahmsweise viel, rollt der Text darin, statt die Blase
         * über den Bildschirm wachsen zu lassen.
         */}
        {letzteVonNina && (
          <div
            key={letzteVonNina.id}
            className={cn(
              "max-h-[40dvh] overflow-y-auto rounded-(--radius-sheet) bg-raised px-4 py-3.5 shadow-lg",
              "motion-safe:animate-[fade-up_180ms_ease-out]",
            )}
          >
            {/*
              Der Name über der Nachricht, nicht über der Karte.
              
              Oben am Fenster war er eine Beschriftung für etwas, das
              man selbst geöffnet hatte. Über der Nachricht ist er das,
              was er in jedem Messenger ist: die Angabe, wer spricht.
              Deshalb steht er auch nur dort, wo tatsächlich jemand
              spricht — nicht über dem leeren Eingabefeld.
            */}
            {/*
              Titelschrift statt Monospace.
              
              Die Laufschrift war für Zahlen gedacht — gleiche
              Zeichenbreite, damit Spalten nicht springen. Ein Name
              hat keine Spalte, und in Monospace liest er sich wie
              eine Datenbankausgabe. Instrument Sans ist die Schrift,
              die auf dieser Seite ohnehin die Titel trägt.
            */}
            <p className="mb-1 font-titel text-[11px] uppercase tracking-[0.08em] text-ink-3">
              {assistantName}
            </p>

            {letzteVonNina.tools && letzteVonNina.tools.length > 0 && (
              <ul className="mb-1.5 grid gap-1">
                {letzteVonNina.tools.map((w) => (
                  <li key={w.name} className="flex items-center gap-2 text-xs text-ink-3">
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 rounded-full",
                        w.ok === undefined
                          ? "bg-accent motion-safe:animate-pulse"
                          : w.ok
                            ? "bg-positive"
                            : "bg-critical",
                      )}
                    />
                    {w.label}
                  </li>
                ))}
              </ul>
            )}
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
              {/* Kein Schreibbalken — dieselbe Begründung wie im
                  Gespräch: Dass Monday schreibt, sieht man daran, dass
                  Wörter dazukommen. Ein Strich daneben liest sich als
                  vergessene Textmarke. */}
              {letzteVonNina.content}
            </p>
            {!letzteVonNina.streaming && (
              <SpeakButton messageId={letzteVonNina.id} className="-ml-3 mt-0.5 self-start" />
            )}
          </div>
        )}

        {/*
         * „Denkt nach" ist ebenfalls eine eigene, kleinere Blase.
         *
         * Ohne dieses Zeichen wirkt die Zeit zwischen Absenden und
         * Antwort tot, und man drückt ein zweites Mal.
         */}
        {wartetAufAntwort && (
          <p
            role="status"
            aria-live="polite"
            className="w-fit rounded-(--radius-pill) bg-raised px-3.5 py-2 text-sm text-ink-3 shadow-lg motion-safe:animate-[fade-up_180ms_ease-out]"
          >
            {assistantName} denkt nach …
          </p>
        )}

        {nina.error && (
          <p
            role="alert"
            className="rounded-(--radius-lg) bg-caution-soft px-4 py-3 text-sm leading-relaxed text-ink-2 shadow-lg"
          >
            {nina.error}
          </p>
        )}

        {/* ── Eingabe ─────────────────────────────────────────── */}
        <Composer
          /* Der Zähler im Provider merkt sich das Senden — hier
             braucht es nichts weiter. */
          onSend={(text, options) => void nina.send(text, options)}
          busy={nina.busy}
          modellwahl
          onListeningChange={nina.setListening}
          placeholder={`${assistantName} fragen …`}
          dokumenteFür={assistantName}
        />

        <div ref={ende} />
      </div>
    </div>
  );
}
