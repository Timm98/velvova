"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Eine Auswahl, die man durchsuchen kann.
 *
 * Vier Felder auf der Seite „Sprache & Region" hatten zusammen 1126
 * `<option>`-Elemente: 273 Länder zweimal, 418 Zeitzonen, 162
 * Währungen. Das hatte zwei Kosten, eine gemessene und eine, die man
 * nur beim Benutzen merkt.
 *
 *   **243 KB im Dokument.** Jede Option ist im HTML rund 200 Byte.
 *   Übertragen wurde damit vor allem eine Liste, von der eine Person
 *   genau einen Eintrag anfasst.
 *
 *   **Kein Weg zu „Pacific/Auckland".** In einem nativen Auswahlfeld
 *   mit 418 Einträgen sucht man durch Scrollen. Tippen springt zum
 *   ersten passenden Anfangsbuchstaben und hört dort auf — wer die
 *   Zeitzone nicht nach ihrem Kontinent benennen kann, findet sie nicht.
 *
 * Deshalb hier: ein Eingabefeld mit Vorschlagsliste. Getippt wird
 * gesucht, angezeigt werden die Treffer, übertragen wird nichts.
 *
 * **Die Liste entsteht im Browser.** Länder, Zeitzonen und Währungen
 * kommen aus `Intl` — und `Intl` gibt es hier genauso wie auf dem
 * Server. Sie über die Leitung zu schicken hiesse, Daten zu senden, die
 * am Ziel bereits liegen.
 *
 * **Der Wert steht in einem versteckten Feld.** Damit ändert sich für
 * das Formular nichts: es liest weiterhin `name`, bekommt weiterhin den
 * Code, und die Server-Aktion dahinter bleibt unangetastet. Kommt das
 * JavaScript nicht an, wird der bisherige Wert unverändert
 * mitgeschickt — das Formular verliert also nichts, es lässt dieses
 * eine Feld nur, wie es war.
 */

export interface KombiEintrag {
  wert: string;
  text: string;
  /** Zusatz für die Suche, der nicht angezeigt wird — etwa der Code. */
  suchtext?: string;
}

/** Wie viele Treffer gleichzeitig im DOM stehen. */
const SICHTBAR_MAX = 60;

export function Kombifeld({
  id,
  name,
  wert,
  anzeige,
  eintraege,
  platzhalter = "Tippen zum Suchen…",
  className,
}: {
  id: string;
  name: string;
  /** Der gespeicherte Code. */
  wert: string;
  /** Wie der gespeicherte Code heisst — vom Server, damit vor der
   *  Hydration der richtige Name dasteht und nicht der Code. */
  anzeige: string;
  /** Die Liste. Wird erst gebaut, wenn jemand das Feld öffnet. */
  eintraege: () => KombiEintrag[];
  platzhalter?: string;
  className?: string;
}) {
  const listenId = useId();
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState("");
  const [gewaehlt, setGewaehlt] = useState({ wert, anzeige });
  const [aktiv, setAktiv] = useState(0);
  /*
   * Die Liste wird einmal gebaut, beim ersten Öffnen.
   *
   * 273 Länder durch `Intl.DisplayNames` zu schicken kostet ein paar
   * Millisekunden — beim Seitenaufbau wären das ein paar Millisekunden
   * für ein Feld, das die meisten nie anfassen.
   */
  const [liste, setListe] = useState<KombiEintrag[] | null>(null);

  const feld = useRef<HTMLInputElement>(null);
  const huelle = useRef<HTMLDivElement>(null);
  const listenfeld = useRef<HTMLUListElement>(null);

  const treffer = useMemo(() => {
    if (!liste) return [];
    const q = suche.trim().toLowerCase();
    if (!q) return liste;
    /*
     * Treffer am Wortanfang zuerst.
     *
     * „Ind" soll Indien vor Grönland (Kalaallit Nunaat) bringen, auch
     * wenn beide das Bruchstück enthalten. Ohne diese Sortierung steht
     * das Gesuchte oft an Position vierzig.
     */
    const beginnt: KombiEintrag[] = [];
    const enthaelt: KombiEintrag[] = [];
    for (const e of liste) {
      const t = e.text.toLowerCase();
      const s = e.suchtext?.toLowerCase() ?? "";
      if (t.startsWith(q) || s.startsWith(q)) beginnt.push(e);
      else if (t.includes(q) || s.includes(q)) enthaelt.push(e);
    }
    return [...beginnt, ...enthaelt];
  }, [liste, suche]);

  const gezeigt = treffer.slice(0, SICHTBAR_MAX);

  function oeffnen() {
    if (!liste) setListe(eintraege());
    setOffen(true);
    setSuche("");
    setAktiv(0);
  }

  function schliessen() {
    setOffen(false);
    setSuche("");
  }

  function waehlen(e: KombiEintrag) {
    setGewaehlt({ wert: e.wert, anzeige: e.text });
    schliessen();
    feld.current?.focus();
  }

  // Klick daneben schliesst. Ohne das bleibt die Liste offen, während
  // jemand längst im nächsten Feld tippt.
  useEffect(() => {
    if (!offen) return;
    const beiKlick = (ev: MouseEvent) => {
      if (!huelle.current?.contains(ev.target as Node)) schliessen();
    };
    document.addEventListener("mousedown", beiKlick);
    return () => document.removeEventListener("mousedown", beiKlick);
  }, [offen]);

  // Der hervorgehobene Eintrag muss sichtbar bleiben, sonst führt die
  // Pfeiltaste ins Nichts.
  useEffect(() => {
    if (!offen) return;
    listenfeld.current
      ?.querySelector<HTMLElement>(`[data-index="${aktiv}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [aktiv, offen]);

  function beiTaste(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (!offen && (ev.key === "ArrowDown" || ev.key === "Enter")) {
      ev.preventDefault();
      oeffnen();
      return;
    }
    if (!offen) return;

    switch (ev.key) {
      case "ArrowDown":
        ev.preventDefault();
        setAktiv((i) => Math.min(i + 1, gezeigt.length - 1));
        break;
      case "ArrowUp":
        ev.preventDefault();
        setAktiv((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        ev.preventDefault();
        setAktiv(0);
        break;
      case "End":
        ev.preventDefault();
        setAktiv(gezeigt.length - 1);
        break;
      case "Enter": {
        ev.preventDefault();
        const e = gezeigt[aktiv];
        if (e) waehlen(e);
        break;
      }
      case "Escape":
        ev.preventDefault();
        schliessen();
        break;
      case "Tab":
        schliessen();
        break;
    }
  }

  return (
    <div ref={huelle} className={cn("relative", className)}>
      {/* Was das Formular liest. Unverändert derselbe Name, derselbe
          Code — die Server-Aktion merkt vom Umbau nichts. */}
      <input type="hidden" name={name} value={gewaehlt.wert} />

      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
          strokeWidth={2}
        />
        <input
          ref={feld}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={offen}
          aria-controls={listenId}
          aria-autocomplete="list"
          aria-activedescendant={offen && gezeigt[aktiv] ? `${listenId}-${aktiv}` : undefined}
          autoComplete="off"
          /* Beim Öffnen ist das Feld leer und der gewählte Name steht
             als Platzhalter: so muss niemand erst löschen, um zu
             suchen, und sieht trotzdem, was gerade eingestellt ist. */
          value={offen ? suche : gewaehlt.anzeige}
          placeholder={offen ? gewaehlt.anzeige || platzhalter : platzhalter}
          onFocus={oeffnen}
          /*
           * Klicken öffnet auch, wenn das Feld den Fokus schon hat.
           *
           * `onFocus` allein reichte nicht: nach einer Auswahl gibt
           * `waehlen()` den Fokus an das Feld zurück. Ein zweiter Klick
           * darauf löst dann kein `focus`-Ereignis mehr aus — die Liste
           * blieb zu, und wer seine Wahl korrigieren wollte, musste
           * erst irgendwo anders hin klicken und wieder zurück.
           *
           * Gefunden hat das eine Tastaturprüfung, nicht das Auge: sie
           * wählte Portugal, klickte erneut und fand keine Liste vor.
           */
          onClick={() => {
            if (!offen) oeffnen();
          }}
          onChange={(ev) => {
            if (!offen) oeffnen();
            setSuche(ev.target.value);
            setAktiv(0);
          }}
          onKeyDown={beiTaste}
          className={cn(
            "h-11 w-full rounded-(--radius-sm) border border-line bg-surface pl-9 pr-9 text-[15px] text-ink",
            "placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25",
          )}
        />
        <ChevronDown
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-3 transition-transform",
            offen && "rotate-180",
          )}
          strokeWidth={2}
        />
      </div>

      {offen && (
        /*
         * Die Hinweiszeilen stehen NEBEN der Liste, nicht darin.
         *
         * Eine `role="listbox"` darf nach ARIA nur `option`-Kinder
         * haben. „Kein Treffer" und „37 weitere" als `<li>` dazwischen
         * waren zwei axe-Verstösse — `aria-required-children` und
         * `listitem` — und für ein Vorlesegerät schlimmer als das: es
         * hätte sie als auswählbare Einträge angesagt, die sich nicht
         * auswählen lassen.
         */
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-(--radius-sm) border border-line bg-surface shadow-lg">
        <ul
          ref={listenfeld}
          id={listenId}
          role="listbox"
          aria-label="Vorschläge"
          className="max-h-72 overflow-y-auto py-1 empty:hidden"
        >
          {gezeigt.map((e, i) => (
            <li
              key={e.wert}
              id={`${listenId}-${i}`}
              data-index={i}
              role="option"
              aria-selected={e.wert === gewaehlt.wert}
              /* `mousedown` statt `click`: ein Klick nimmt dem
                 Eingabefeld erst den Fokus, und der Fokusverlust hätte
                 die Liste geschlossen, bevor die Auswahl ankommt. */
              onMouseDown={(ev) => {
                ev.preventDefault();
                waehlen(e);
              }}
              onMouseEnter={() => setAktiv(i)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-[15px] text-ink",
                i === aktiv && "bg-surface-soft",
              )}
            >
              <span className="truncate">{e.text}</span>
              {e.wert === gewaehlt.wert && (
                <Check aria-hidden className="size-4 shrink-0 text-accent" strokeWidth={2.5} />
              )}
            </li>
          ))}
        </ul>

        {/*
         * Nicht schweigend abschneiden.
         *
         * Wer „a" tippt, bekommt 60 von rund 200 Treffern zu sehen.
         * Ohne diese Zeile sähe das aus, als gäbe es nicht mehr — und
         * jemand würde aufhören zu suchen, weil er glaubt, sein Land
         * sei nicht dabei.
         *
         * `aria-live`, damit die Zahl auch ankommt, wenn niemand
         * hinsieht: beim Tippen ändert sie sich mit jedem Zeichen.
         */}
        {(gezeigt.length === 0 || treffer.length > gezeigt.length) && (
          <p aria-live="polite" className="border-t border-line px-3 py-2 text-xs text-ink-3">
            {gezeigt.length === 0
              ? `Kein Treffer für „${suche}“.`
              : `${treffer.length - gezeigt.length} weitere Treffer — tippe genauer.`}
          </p>
        )}
        </div>
      )}
    </div>
  );
}
