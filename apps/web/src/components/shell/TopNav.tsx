"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BEREICHSMENUE, hatMenue } from "./bereichsmenue";
import { Sprachwahl } from "./Sprachwahl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bell, Briefcase, Building2, CircleQuestionMark, FileText, MessagesSquare, Mic, Puzzle, Search, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { useBestand } from "@/components/marketing/BestandProvider";

/**
 * Der obere Header.
 *
 * Er ersetzt die permanente linke Icon-Leiste. Der Grund ist nicht
 * Geschmack: eine schmale Spalte aus Symbolen ohne Beschriftung ist die
 * Form, die Verwaltungssoftware seit zwanzig Jahren benutzt, und sie
 * bringt genau deren Anmutung mit. Wer einen Job sucht, arbeitet nicht
 * in einem Admin-Panel.
 *
 * Fünf Bereiche mit Namen, mittig. Aktiv ist eine weiche Kapsel, keine
 * Unterstreichung und kein Rechteck.
 *
 * Der Monday-Knopf steht rechts als Pille. Er öffnet den Drawer, ohne die
 * Seite neu zu laden — der Zustand liegt im Provider, der über der
 * Route sitzt.
 *
 * Hier steht bewusst KEINE Monday.
 *
 * Vorher trug der Header an drei Stellen den Signalring: als Marke, im
 * Bereich „Monday" und auf der Pille. Daneben stand auf der Gesprächs-
 * seite die echte Monday aus nina.glb — und damit sahen Menschen zwei
 * verschiedene Mondays gleichzeitig. Genau das verbietet die Vorgabe.
 *
 * Der naheliegende Ausweg wäre gewesen, auch in den Header das Modell
 * zu setzen. Er ist falsch, und zwar aus derselben Vorgabe: „Das Modell
 * darf nicht als unlesbare kleine Kugel erscheinen." Bei 28 Pixeln wäre
 * es genau das — dazu ein zweiter WebGL-Kontext und 12 MB auf jeder
 * Seite, auf der niemand Monday sehen will.
 *
 * Also die Trennung: die GLB-Monday zeigt Monday als Gegenüber. Der Header
 * zeigt WEGE — und ein Weg zu einem Gespräch wird durch ein
 * Gesprächssymbol beschrieben, nicht durch ein Gesicht. Links steht die
 * Marke Velvova, nicht Monday.
 */

const BEREICHE: {
  href: string;
  label: string;
  icon: typeof MessagesSquare;
  /** Nur genau diese Route, nicht auch die darunter. */
  exact?: boolean;
}[] = [
  /*
   * Kein „Heute" mehr.
   *
   * Es zeigte auf `/app` — eine zweite Startseite für Angemeldete.
   * Die gibt es nicht mehr: Die Startseite ist für beide dieselbe,
   * angemeldet kommt eine Begrüssung dazu. Ein Weg dorthin steht
   * ohnehin schon links im Schriftzug.
   */
  { href: "/app/monday", label: "Monday", icon: MessagesSquare },
  { href: "/app/jobs", label: "Jobs", icon: Briefcase },
  { href: "/app/applications", label: "Bewerbungen", icon: FileText },
  /*
   * Ausprobieren steht vor dem Profil.
   *
   * Ein Profil auszufüllen ist Arbeit, die man später erledigt. Eine
   * Aufgabe von neunzig Sekunden macht man jetzt — und sie sagt mehr
   * über die passende Arbeit als drei ausgefüllte Felder.
   */
  /* Puzzleteil. Vorher ein Laborkolben („Experiment mit ungewissem
     Ausgang"), dann eine Zielscheibe („triff oder verfehl") — beide
     erzählen die falsche Geschichte. Bei einer Arbeitsprobe geht es
     darum, ob ein Stück passt. */
  { href: "/app/proben", label: "Ausprobieren", icon: Puzzle },
  /*
   * FAQ statt Profil.
   *
   * Das Profil steht bereits im Konto-Menü rechts oben — dort, wo es
   * jeder sucht, und dort, wo auch Einstellungen und Abmelden liegen.
   * Ein zweiter Weg dorthin in der Hauptleiste kostete einen der
   * sechs Plätze, ohne einen neuen Ort zu erschliessen.
   *
   * Die Hilfe hatte dagegen gar keinen. Wer nicht weiterweiss, sucht
   * sie oben — nicht im Fuss, an dem er vorbeiscrollen muss.
   *
   * Das Ziel ist `/app/faq`, nicht `/help`: Der öffentliche Rahmen
   * hat eine eigene, kleinere Kopfzeile — ein Klick dorthin hätte
   * mitten in der Arbeit die ganze Umgebung ausgetauscht. `/help`
   * bleibt für Besucher ohne Konto.
   */
  { href: "/app/faq", label: "FAQ", icon: CircleQuestionMark },
  /*
   * ── „Für Unternehmen" und „Sicherheit" standen hier ────────────
   *
   * Beides sind öffentliche Marketingseiten, und sie standen in der
   * ARBEITSnavigation — gleichrangig neben Bewerbungen. Wer angemeldet
   * ist, benutzt das Produkt bereits; ihm dabei zu erklären, was es
   * kann, ist die Sorte Werbung, die man wegklickt und danach auch
   * die nützlichen Hinweise.
   *
   * Sie sind nicht verschwunden: `BESUCHER` führt sie weiterhin für
   * alle ohne Konto, und der Fussbereich führt beide. Geprüft, bevor
   * sie hier herauskamen — ein Ziel, das nirgends mehr steht, ist
   * gelöscht und nicht aufgeräumt.
   */
] as const;

/**
 * Was Besucher sehen, die noch nicht angemeldet sind.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es zwei Listen braucht
 * ══════════════════════════════════════════════════════════════
 *
 * `BEREICHE` führt an fünf von sieben Stellen nach `/app/…`. Für
 * Angemeldete ist das genau richtig. Für alle anderen ist es eine
 * Navigation, die bei jedem Klick zur Anmeldung umleitet — sieben
 * Wege, sechs davon Sackgassen.
 *
 * Bis heute fiel das nicht auf, weil die Startseite ihre Erklärungen
 * in vierzehn Abschnitten selbst mitbrachte. Seit sie reduziert ist,
 * IST die Navigation der Weg zu diesen Erklärungen — und dann muss
 * sie auch dorthin führen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum flach und ohne Aufklappmenüs
 * ══════════════════════════════════════════════════════════════
 *
 * TopNav kennt keine Untermenüs. Eines zu bauen hiesse, Zustand,
 * Tastaturbedienung, Fokusfalle und Schliessverhalten neu zu
 * erfinden — für fünf Ziele, die auch nebeneinander passen.
 *
 * Alle fünf zeigen auf öffentliche Seiten, die es bereits gibt und
 * die geprüft mit 200 antworten. Kein Ziel ist erfunden.
 */
const BESUCHER: typeof BEREICHE = [
  /* Was die Anwendung konkret tut. */
  { href: "/product", label: "Lösungen", icon: Briefcase },
  /* Der Ansatz dahinter — getrennt vom Was, wie es der Auftrag verlangt. */
  { href: "/how-it-works", label: "Warum Velvova", icon: Puzzle },
  { href: "/for-business", label: "Für Unternehmen", icon: Building2 },
  { href: "/help", label: "Ressourcen", icon: CircleQuestionMark },
  /* Bleibt: Der Eintrag war schon da und führt weiterhin irgendwohin. */
  { href: "/security", label: "Sicherheit", icon: ShieldCheck },
];

/**
 * Kein Eintrag setzt `exact` mehr, seit „Heute" weg ist.
 *
 * Die Prüfung bleibt trotzdem: Sie kostet nichts und ist genau das,
 * was ein Eintrag auf einer Wurzelroute braucht. Ohne sie wäre `/app`
 * unter jedem `/app/…` aktiv — der Fehler, der beim nächsten solchen
 * Eintrag stumm zurückkäme.
 */
function istAktiv(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav({
  brandName,
  userName,
  userEmail,
  unreadCount,
  accountMenu,
  onOpenSearch,
  stellenzahl,
  stellenGenau,
  proSekunde = 0,
  sprache,
  angemeldet = true,
}: {
  brandName: string;
  userName: string | null;
  userEmail: string;
  unreadCount: number;
  accountMenu?: React.ReactNode;
  onOpenSearch?: () => void;
  /**
   * Ob jemand angemeldet ist.
   *
   * Der Kopf ist in beiden Fällen derselbe — gleiche Höhe, gleiche
   * Suche, gleiche Wege. Nur rechts stehen statt Glocke und Profil
   * zwei Verweise. Ein eigener, kleinerer Kopf für Besucher hiesse,
   * die Umgebung beim Anmelden auszutauschen.
   */
  angemeldet?: boolean;
  /* Bestandsgrösse für die Beschriftung der Suche. Serverseitig
     geladen und durchgereicht — dies ist eine Client-Komponente. */
  stellenzahl?: string;
  /** Der genaue Stand — Grundlage für den mitlaufenden Platzhalter. */
  stellenGenau?: number;
  /** Gemessener Zuwachs je Sekunde. Null hält den Platzhalter an. */
  proSekunde?: number;
  /** Die aufgelöste Sprache. Fehlt sie, erscheint keine Auswahl. */
  sprache?: string;
}) {
  const pathname = usePathname();

  /*
   * ══════════════════════════════════════════════════════════════
   * Die Wege richten sich nach der Seite, nicht nach der Sitzung
   * ══════════════════════════════════════════════════════════════
   *
   * Hier stand `angemeldet ? BEREICHE : BESUCHER`. Das klang richtig
   * und war es an genau einer Stelle nicht: auf den Marketingseiten.
   *
   * Wer angemeldet ist und die Startseite, „Lösungen" oder „Für
   * Unternehmen" öffnet, bekam dort die App-Wege — Monday, Jobs,
   * Bewerbungen. Auf einer Seite, die erklärt, was das Produkt ist,
   * fehlte damit jeder Weg zu den übrigen Erklärseiten. „Lösungen"
   * stand für Besucher oben und für Angemeldete nicht, obwohl beide
   * dieselbe Seite ansahen.
   *
   * Massgeblich ist deshalb der Ort: Unter `/app` und `/business`
   * arbeitet man, überall sonst liest man. Die Anmeldung entscheidet
   * weiterhin über die Knöpfe rechts oben — nur nicht mehr darüber,
   * welche Seiten es gibt.
   */
  /*
   * ══════════════════════════════════════════════════════════════
   * Das offene Aufklappmenü
   * ══════════════════════════════════════════════════════════════
   *
   * Ein einziger Zustand für alle Punkte, nicht einer je Punkt: Es
   * darf immer nur eines offen sein, und mit fünf unabhängigen
   * Zuständen müsste jeder beim Öffnen die vier anderen schliessen.
   *
   * Der Wert ist die Route des Punktes, nicht sein Index — dann
   * verschiebt sich nichts, wenn die Liste sich ändert.
   */
  const [menue, setMenue] = useState<string | null>(null);
  /*
   * Wo das Feld ansetzt — gemessen am Knopf, der es geöffnet hat.
   *
   * Mittig unter der Zeile war der erste Versuch und sah falsch aus:
   * Man klickt rechts auf „Ressourcen" und es klappt in der Mitte auf,
   * ohne sichtbaren Zusammenhang zum Wort. Das Feld gehört unter sein
   * Wort.
   *
   * `null` heisst „noch nicht gemessen"; solange bleibt es unsichtbar,
   * damit es nicht einen Bildschirm lang an der falschen Stelle steht.
   */
  const [ankerX, setAnkerX] = useState<number | null>(null);
  const menueRef = useRef<HTMLDivElement | null>(null);
  const kopfRef = useRef<HTMLElement | null>(null);
  /*
   * Eine kurze Frist beim Verlassen mit der Maus.
   *
   * Zwischen dem Wort oben und dem Feld darunter liegen ein paar
   * Pixel Luft. Ohne Frist schliesst das Menü genau dort — man zieht
   * die Maus nach unten und es ist weg, bevor man ankommt.
   */
  const zuUhr = useRef<ReturnType<typeof setTimeout> | null>(null);

  function oeffne(href: string, knopf?: HTMLElement | null) {
    if (zuUhr.current) clearTimeout(zuUhr.current);
    if (knopf && kopfRef.current) {
      const k = knopf.getBoundingClientRect();
      const h = kopfRef.current.getBoundingClientRect();
      setAnkerX(k.left - h.left);
    }
    setMenue(href);
  }
  function schliesseGleich() {
    if (zuUhr.current) clearTimeout(zuUhr.current);
    setMenue(null);
    setAnkerX(null);
  }
  function schliesseBald() {
    if (zuUhr.current) clearTimeout(zuUhr.current);
    zuUhr.current = setTimeout(() => setMenue(null), 180);
  }

  /* Beim Seitenwechsel zu. Sonst steht es nach dem Klick noch offen
     über der neuen Seite. */
  useEffect(() => {
    schliesseGleich();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /*
   * Escape schliesst, Klick daneben auch.
   *
   * Beides gehört zusammen und wird gern vergessen: Ein Menü, das nur
   * durch erneuten Klick auf dasselbe Wort zugeht, ist eine Falle für
   * jeden, der es versehentlich geöffnet hat.
   */
  /*
   * Nach dem Zeichnen prüfen, ob das Feld rechts hinausragt.
   *
   * Die Breite steht erst fest, wenn der Inhalt da ist — sie hängt an
   * der Zahl der Spalten und am längsten Eintrag darin. Vorher zu
   * rechnen hiesse raten.
   *
   * `useLayoutEffect` und nicht `useEffect`: Die Korrektur muss vor
   * dem ersten Anzeigen sitzen, sonst springt das Feld sichtbar.
   */
  useLayoutEffect(() => {
    if (!menue || ankerX === null) return;
    const feld = menueRef.current;
    const kopf = kopfRef.current;
    if (!feld || !kopf) return;
    const rand = 16;
    const platz = kopf.clientWidth - rand;
    const breite = feld.offsetWidth;
    const korrigiert = Math.max(rand, Math.min(ankerX, platz - breite));
    if (Math.abs(korrigiert - ankerX) > 0.5) setAnkerX(korrigiert);
  }, [menue, ankerX]);

  useEffect(() => {
    if (!menue) return;
    function taste(e: KeyboardEvent) {
      if (e.key === "Escape") schliesseGleich();
    }
    function daneben(e: MouseEvent) {
      if (!menueRef.current?.contains(e.target as Node)) schliesseGleich();
    }
    document.addEventListener("keydown", taste);
    document.addEventListener("mousedown", daneben);
    return () => {
      document.removeEventListener("keydown", taste);
      document.removeEventListener("mousedown", daneben);
    };
  }, [menue]);

  const imArbeitsbereich = pathname.startsWith("/app") || pathname.startsWith("/business");
  const wege = imArbeitsbereich ? BEREICHE : BESUCHER;
  /*
   * Nur die Handlungen.
   *
   * Der Header steht auf jeder Seite. Läse er den Gesprächszustand,
   * liefe er bei jedem gestreamten Zeichen neu durch — und mit ihm die
   * gesamte Navigation.
   */
  /*
   * Kein Scroll-Zuhörer mehr.
   *
   * Hier stand einer, der bei jedem Scrollschritt einen Zustand setzte,
   * damit ein Schatten erscheint. Der Schatten ist einer festen Linie
   * gewichen — und damit war der Zuhörer ein React-Zustand, der die
   * ganze Navigation bei jedem Rad-Ereignis neu bewerten liess, ohne
   * dass sich etwas ändern konnte.
   */

  return (
    <header
      ref={kopfRef}
      /*
       * Zwei Reihen statt einer.
       *
       * Vorher teilten sich Marke, sechs Bereiche und drei
       * Werkzeugknöpfe eine einzige 76-Pixel-Zeile. Für eine Suche war
       * darin kein Platz — deshalb lag sie hinter einem Lupensymbol,
       * und eine Suche, die man erst finden muss, ist auf einem
       * Stellenmarkt die falsche Sparsamkeit.
       *
       * Oben liegt jetzt, was zum Konto gehört: Marke links, Suche in
       * der Mitte, Glocke und Profil rechts auf Höhe des Logos. Unten
       * die Wege durch die Anwendung, mittig, mit Symbol *und* Wort —
       * ein Symbol allein ist eine Vokabel, die jeder Nutzer erst
       * lernen muss.
       *
       * Eine Linie statt eines Leuchtens: `backdrop-blur` auf
       * halbdurchsichtigem Grund kostet auf schwächeren Geräten bei
       * jedem Scrollschritt eine Neuberechnung der Fläche dahinter und
       * trennt nicht besser als ein Strich.
       */
      /*
       * Nicht klebend.
       *
       * Ein Kopf, der beim Scrollen mitfährt, kostet auf jeder Seite
       * dauerhaft 140 Pixel Höhe — auf dem Telefon ein Fünftel des
       * Bildschirms, und zwar genau dann, wenn man eine lange
       * Trefferliste liest. Er steht auf jeder Seite, aber er darf
       * hochscrollen.
       */
      /*
         `uebergang-kopf`: Beim Seitenwechsel bleibt die Kopfzeile
         stehen.

         Ohne eigenen Namen gehört sie zur Wurzel und fährt mit ihr
         nach oben aus dem Bild — dann wandert alles, und man verliert
         den Halt. Mit eigenem Namen ist sie eine eigene Gruppe: Sie
         steht auf beiden Seiten an derselben Stelle, also bewegt der
         Browser sie nicht.

         Der Sinn ist nicht Ruhe um ihrer selbst willen. Die Kopfzeile
         sagt, dass man noch in derselben Anwendung ist — genau die
         Auskunft, die man braucht, während der Rest in Bewegung ist.

         `sticky top-0` gehört dazu: Eine Kopfzeile, die beim Scrollen
         nach oben verschwindet, steht beim Seitenwechsel an einer
         anderen Stelle als auf der Zielseite — und dann bewegt der
         Browser sie doch. Gemessen: -34 gegen +37 Pixel, je nach
         Rollstand. Oben festgehalten sind es beide Male 0.

         Und es ist auch ohne Übergang das Richtige: Suche und Wege
         gehören zu den Dingen, die man mitten im Lesen braucht.
      */
      /*
       * `relative z-40` — sonst bleibt das Kontomenü unsichtbar.
       *
       * `view-transition-name` oben macht die Kopfzeile zu einem
       * eigenen Stapelkontext. Solange sie dabei *statisch* steht,
       * wird ihr gesamter Inhalt in den Ebenen für nicht positionierte
       * Elemente gemalt — also unter jedem `relative` im Seiteninhalt,
       * ganz gleich, welches `z-index` darin steht.
       *
       * Das Kontomenü hat `z-50` und kam trotzdem nicht heraus: Es
       * öffnete sich, war aber ab der Unterkante der Kopfzeile von der
       * Seite verdeckt. Von aussen sah das aus, als klappe es nicht auf.
       *
       * Gemessen: 40 Pixel unter der Kopfzeile lag nicht ein dort
       * eingesetztes `z-50`-Feld obenauf, sondern das `canvas` des Cores.
       *
       * Positioniert ist die Kopfzeile ein Stapelkontext *mit* Ebene.
       * 40 lässt die Befehlspalette (`z-[60]`) darüber — die legt sich
       * absichtlich über alles.
       */
      className="uebergang-kopf relative z-40 border-b border-line bg-page"
    >
      {/* ── Reihe 1: Marke · Suche · Konto ─────────────────── */}
      {/*
        `relative`, weil die Suche absolut in der Mitte sitzt.
        Im Flussbild wäre sie nur *ungefähr* mittig: Links steht die
        Marke, rechts Glocke und Konto, und die beiden sind nie gleich
        breit. Ein Suchfeld, das um dreissig Pixel danebensteht, sieht
        nicht nach Zufall aus, sondern nach Nachlässigkeit.
      */}
            {/*
        ── Warum die Aussenhalter `min-w-fit` tragen ────────────────

        Das Feld sass rechts der Seitenmitte: „Velvova" ist breiter als
        Glocke und Kontobild zusammen, und was nur den Rest zwischen
        beiden nimmt, landet um die halbe Differenz daneben. `flex-1
        basis-0` an beiden Seiten teilt den freien Platz zu gleichen
        Teilen — damit liegt die Mitte dazwischen in der Seitenmitte.

        `min-w-fit` ist dabei die tragende Angabe: Ohne sie fielen die
        Halter unter die Breite ihres Inhalts (gemessen 92 Pixel bei
        einer Knopfgruppe von 250), und die Knöpfe liefen aus ihrem
        Kasten heraus über das Feld. Mit ihr hört jeder Halter bei
        seinem Inhalt auf, und was zu eng wird, gibt das Feld nach.

        Hier stand kurz ein Raster mit `minmax(max-content,1fr)`. In
        Chromium sass es auf den Pixel genau — Safari verwirft die
        Regel, das Raster wurde einspaltig, und Feld und Knöpfe
        rutschten untereinander. Gemeldet aus Safari, gemessen war es
        in Chromium richtig. Deshalb Flexbox: Sie kann hier dasselbe
        und wird überall gleich gelesen.
      */}
      <div className="relative mx-auto flex h-[88px] w-full max-w-(--breite-inhalt) items-center gap-4 px-5 md:px-8">
        <div className="flex min-w-fit flex-1 basis-0 items-center">
        <Link
          href="/"
          /* Auf schmalen Geräten fällt die Wortmarke weg — dann bliebe
             ein 36-Pixel-Ziel. Die Fläche trägt die geforderten 44.

             Der Einzug nach rechts wächst mit dem Fenster und nur dort:
             Auf dem Telefon ist der Rand ohnehin knapp, und ein
             eingerückter Schriftzug ginge dort auf Kosten der Suche
             daneben. Ab der mittleren Breite ist Platz übrig, und
             ein Schriftzug, der nicht an der Kante klebt, sitzt
             ruhiger. */
          /*
             Kein Einzug mehr nach rechts.
             
             Hier stand `md:ml-6 lg:ml-12` — 48 Pixel zusätzlich, damit
             der Schriftzug „nicht an der Kante klebt". Gemessen im
             Vergleich mit der Vorlage war das der Grund, warum der
             Kopf breiter wirkt als der Inhalt darunter:
             
               Vorlage   Logo bei 269, Inhalt bei 269   bündig
               wir       Logo bei 344, Inhalt bei 264   75 daneben
             
             Der Schriftzug klebt auch ohne Einzug nicht: Der Behälter
             hat `px-5`, ab `md` `px-8`. */
          className="flex min-h-11 min-w-11 shrink-0 items-center gap-2.5 rounded-(--radius-pill) px-1"
          aria-label={brandName}
        >
          {/*
            Nur der Schriftzug.
            
            Daneben stand ein blaues Quadrat mit dem Anfangsbuchstaben —
            der Platzhalter, den man nimmt, solange es kein Zeichen gibt.
            Zwei Marken nebeneinander sind eine zu viel, und ein „V" im
            Kasten sagt weniger als das ausgeschriebene Wort.

            Auf schmalen Geräten bleibt der Schriftzug jetzt stehen:
            Vorher fiel er weg und übrig war das Quadrat. Ohne Quadrat
            gäbe es dort gar keine Marke mehr.
          */}
          <span className="font-display text-[22px] font-extrabold leading-none tracking-[-0.035em] sm:text-[26px] lg:text-[30px]">
            {brandName}
          </span>
        </Link>
        </div>

        {/* ── Suche, mittig ─────────────────────────────────── */}
        <Kopfsuche stellenzahl={stellenzahl} genau={stellenGenau} proSekunde={proSekunde} />

        <div className="flex min-w-fit flex-1 basis-0 items-center justify-end gap-1">
          {/*
            Die Sprachauswahl vor Glocke und Profil.

            Sie gehört zu den Einstellungen, nicht zum Konto — und
            links der beiden runden Knöpfe fällt sie weniger auf als
            zwischen ihnen. Ohne `sprache` erscheint sie gar nicht:
            `sprache` ist wahlfrei: Wo eine Seite die aufgelöste
            Sprache zur Hand hat, spart sie damit einen
            Zeichenwechsel. Sonst liest die Auswahl sie vom `lang` der
            Seite — derselben Quelle, aus der auch die Texte kommen.
          */}
          <Sprachwahl aktuell={sprache} />
          {!angemeldet ? (
            <>
              {/* Unter 640 Pixeln fällt „Anmelden" weg und der zweite
                  Knopf wird kürzer — sonst schieben Marke, Suche und
                  zwei Verweise die Zeile über den Rand. Gemessen bei
                  320 Pixeln: 66 Pixel Überstand. */}
              <Link
                href="/login"
                className="hidden h-11 items-center rounded-(--radius-pill) px-4 text-[15px] font-medium text-ink transition-colors hover:text-accent-text sm:inline-flex"
              >
                Anmelden
              </Link>
              <Link
                href="/register"
                className="inline-flex h-11 shrink-0 items-center rounded-(--radius-pill) bg-accent px-4 text-sm font-semibold text-accent-on transition-opacity hover:opacity-90 sm:px-5 sm:text-[15px]"
              >
                <span className="hidden sm:inline">Konto anlegen</span>
                <span className="sm:hidden">Registrieren</span>
              </Link>
            </>
          ) : (
          <>
          <Link
            href="/app/notifications"
            aria-label={
              unreadCount > 0
                ? `Benachrichtigungen: ${unreadCount} ungelesen`
                : "Benachrichtigungen"
            }
            /* `rounded-full`, nicht das Formtoken: Ein Symbolknopf ohne
               Beschriftung ist eine Fläche um ein rundes Zeichen — als
               Rechteck mit vier Pixeln Ecke sieht die Aufhellung beim
               Überfahren aus wie ein Kästchen, das dort nicht hingehört.
               In der Vorlage steht die Glocke ganz ohne Fläche. */
            className="relative grid size-12 place-items-center rounded-full text-ink transition-colors hover:bg-soft"
          >
            <Bell className="size-[21px]" strokeWidth={2} />
            {unreadCount > 0 && (
              /* Der Zähler bleibt rund. Eine Zahl in einem eckigen
                 Plättchen liest sich als Etikett, nicht als Meldung —
                 und bei einstelligen Zahlen ist es ohnehin ein Kreis. */
              <span className="absolute right-1.5 top-1.5 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 font-mono text-[12px] font-semibold leading-[18px] text-accent-on">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>

          <div className="ml-0.5">{accountMenu}</div>
          <span className="sr-only">{userName ?? userEmail}</span>
          </>
          )}
        </div>
      </div>

      {/* ── Reihe 2: die Wege ─────────────────────────────── */}
      <nav
        aria-label="Hauptbereiche"
        /*
         * Auf schmalen Geräten rollt die Leiste seitlich, statt über
         * den Rand zu laufen. Bei 768 Pixeln standen sieben Wege mit
         * grossen Abständen 57 Pixel über die Seite hinaus.
         */
        /*
         * Mittig, symmetrisch zur Zeile darüber.
         *
         * Ich hatte die Zeile linksbündig gesetzt, weil die Vorlage
         * das so macht — gemessen beginnt dort der erste Weg bei
         * x=648, das Logo bei x=646.
         *
         * Auf Ansage wieder mittig. Der Unterschied zur Vorlage ist
         * gewollt: Dort steht rechts nur Glocke und Bild, hier steht
         * darüber ein Suchfeld, das die Zeile ohnehin mittig teilt.
         * Eine linksbündige Zeile darunter setzt eine zweite Kante
         * gegen eine Mitte, die schon da ist.
         *
         * `justify-center` greift nur, solange Platz ist; darunter
         * rollt die Zeile weiter seitlich.
         */
        /*
         * Ausgeblendet nur für Angemeldete.
         *
         * Unter 768 Pixeln stand hier `hidden` für alle. Für Angemeldete
         * stimmt das: Sie haben `BottomNav`, und zwei Navigationen
         * übereinander sind eine zu viel.
         *
         * Für Besucher stimmte es nicht. `BottomNav` erscheint nur in
         * `AppShell`, also nur nach der Anmeldung — auf dem Telefon
         * standen oben damit genau zwei Dinge: das Logo und „Konto
         * anlegen". Kein Weg zu Lösungen, keiner zu „Warum Velvova",
         * keiner zu „Für Unternehmen". Wer nicht angemeldet ist, kam
         * von der Startseite nirgendwo hin.
         *
         * Die Zeile kann das schon: `laufband` und `overflow-x-auto`
         * sind für schmale Geräte gebaut und rollen seitlich, statt
         * über den Rand zu laufen.
         */
        className={cn(
          "laufband mx-auto w-full max-w-(--breite-inhalt) overflow-x-auto px-5 md:px-8 lg:justify-center",
          /* Ausgeblendet nur dort, wo die untere Leiste dieselben Wege
             trägt — also im Arbeitsbereich. */
          imArbeitsbereich ? "hidden md:flex" : "flex",
        )}
      >
        {/* Mehr Luft zwischen den Wegen: Ohne Symbole stehen jetzt nur
              noch Wörter da, und die brauchen Abstand, um als einzelne
              Ziele lesbar zu bleiben statt als Zeile. */}
          {/* Die Abstände wachsen mit der Breite. Bei 768 Pixeln standen
              sieben Wege mit je 48 Pixeln Abstand 57 Pixel über den
              Rand; ab 1280 ist Platz für die grosszügige Fassung. */}
          {/*
              Kein `mx-auto` mehr auf der Liste.

              In einem Behälter mit `overflow-x: auto` schiebt ein
              automatischer Aussenabstand den Inhalt über den Rand,
              statt ihn zu zentrieren — gemessen 135 Pixel Überstand
              bei 1024. Seit die Zeile linksbündig steht, braucht es
              ihn ohnehin nicht mehr.
            */}
          {/*
              Schmal umbrechen, breit in einer Zeile.

              ── Warum nicht rollen ──────────────────────────────
              Der Behälter kann seitlich rollen, und das war zuerst der
              Plan. Nur: Was rechts aus dem Bild läuft, sieht auf einem
              Telefon niemand — es gibt keine Bildlaufleiste und keinen
              Hinweis darauf, dass da noch etwas kommt. „Sicherheit"
              wäre damit vorhanden und trotzdem unauffindbar.

              Fünf kurze Wörter passen umgebrochen in zwei Zeilen. Das
              kostet 24 Pixel Höhe und zeigt dafür alles.

              ── Warum `shrink-0` ab `md` ────────────────────────
              In einer Zeile ist die Liste ein Flex-Kind in einem
              Behälter mit `overflow-x: auto` und gibt bei Platzmangel
              zuerst nach: Die Wege werden schmaler als ihr Text, und
              mit `whitespace-nowrap` schiebt sich der Text übereinander
              statt zu rollen. Gemessen bei 390 Pixeln — die Liste
              schrumpfte von 514 auf 350 Pixel, und „Für Unternehmen"
              stand quer über „Ressourcen".

              `w-max` allein genügt dafür nicht: Es setzt die Breite,
              nicht die Schrumpfneigung.
            */}
          <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0 whitespace-nowrap pb-2.5 md:w-max md:shrink-0 md:flex-nowrap md:gap-5 lg:gap-8 xl:gap-12">
          {wege.map((b) => {
            const aktiv = istAktiv(pathname, b.href, b.exact);
            const Icon = b.icon;
            const klasse = cn(
              /*
               * Das Wort steht jetzt auf jeder Breite ab `md`.
               *
               * Vorher wurde es zwischen 768 und 1024 Pixeln
               * versteckt, weil die Liste sonst mit Marke und
               * Werkzeugen um dieselbe Zeile stritt und überlief.
               * In einer eigenen Reihe gibt es diesen Streit
               * nicht mehr — und ein Symbol ohne Wort ist eine
               * Vokabel, die man raten muss.
               */
              "flex h-12 items-center justify-center rounded-(--radius-control) px-2 text-[13px] transition-colors duration-(--duration-fast) md:px-3 md:text-[15px]",
              /*
               * Alle Wege in Schwarz, nicht nur der aktive.
               *
               * Vorher stand der aktive schwarz und die übrigen
               * grau — das las sich wie „hier bin ich, der Rest
               * ist ausgegraut". Sie sind aber alle gleich
               * erreichbar. Die Auszeichnung übernimmt die
               * blaue Kapsel und die Fettung; die Schriftfarbe
               * bleibt durchgehend gleich.
               */
              /*
               * Beim Überfahren wird die Schrift blau — keine
               * Fläche darunter.
               *
               * Vorher legte sich eine helle Kapsel unter das
               * Wort. Bei acht Wegen nebeneinander sah das aus,
               * als wäre einer davon ausgewählt: dieselbe Form,
               * die den aktiven Punkt auszeichnet, nur in einem
               * anderen Ton. Wer die Maus über die Zeile zog,
               * bekam den Eindruck, die Seite habe gewechselt.
               *
               * Ein Farbwechsel der Schrift sagt dasselbe —
               * „hier kannst du klicken" — und kann mit der
               * Auszeichnung des aktiven Punktes nicht
               * verwechselt werden.
               */
              "text-ink",
              aktiv
                ? "bg-accent-subtle font-semibold"
                : "font-medium hover:text-accent-text",
            );
            return (
              <li key={b.href}>
                {hatMenue(b.href) ? (
                  /*
                    Ein Knopf, kein Verweis.

                    Er führt nirgendwohin, er öffnet — und genau das
                    muss ein Vorleseprogramm sagen können. Ein `<a>`
                    mit Klick-Empfänger kündigt einen Seitenwechsel an,
                    der nicht kommt. Der Überblick der Abteilung steht
                    als erster Eintrag im Feld darunter, damit der Weg
                    dorthin nicht verlorengeht.
                  */
                  <button
                    type="button"
                    aria-expanded={menue === b.href}
                    aria-controls="bereichsfeld"
                    onClick={(e) =>
                      menue === b.href ? schliesseGleich() : oeffne(b.href, e.currentTarget)
                    }
                    onMouseEnter={(e) => oeffne(b.href, e.currentTarget)}
                    onMouseLeave={schliesseBald}
                    onFocus={(e) => oeffne(b.href, e.currentTarget)}
                    className={cn(klasse, "gap-1.5")}
                  >
                    <span>{b.label}</span>
                    {/*
                      Der Pfeil dreht sich, wenn das Feld offen ist.
                      `aria-hidden`, weil `aria-expanded` dasselbe schon
                      sagt — und zwar in Worten.
                    */}
                    <svg
                      aria-hidden
                      viewBox="0 0 16 16"
                      className={cn(
                        "size-3.5 shrink-0 text-ink-3 transition-transform duration-(--duration-fast)",
                        menue === b.href && "rotate-180",
                      )}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 6.5 8 10.5l4-4" />
                    </svg>
                  </button>
                ) : (
                  <Link
                    href={b.href}
                    aria-current={aktiv ? "page" : undefined}
                    onMouseEnter={schliesseBald}
                    className={klasse}
                  >
                    <span>{b.label}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/*
        ══════════════════════════════════════════════════════════
        Das Feld liegt NEBEN der Zeile, nicht darin
        ══════════════════════════════════════════════════════════

        Die Navigationszeile trägt `overflow-x-auto`, damit sie auf
        schmalen Geräten seitlich rollt. Ein absolut gesetztes Feld
        darin würde an ihrer Unterkante abgeschnitten — man sähe die
        oberste Zeile des Menüs und sonst nichts.

        Deshalb steht es als Geschwister der Zeile und ist an der
        Kopfzeile ausgerichtet, die dafür `relative z-40` trägt. Über
        die volle Breite, wie in der Vorlage: Vier Spalten brauchen
        mehr Platz, als unter einem einzelnen Wort ist.

        `onMouseEnter` hält es offen, während man hineinzieht — ohne
        das schliesst es auf halbem Weg zwischen Wort und Eintrag.
      */}
      {menue && BEREICHSMENUE[menue] ? (
        <div
          id="bereichsfeld"
          ref={menueRef}
          onMouseEnter={() => oeffne(menue)}
          style={{
            left: ankerX ?? 0,
            visibility: ankerX === null ? "hidden" : "visible",
            /*
              Dunkler als `--surface-1`.
              
              Das Feld soll sich vom Seitengrund abheben, nicht
              leuchten. `--surface-1` allein war dafür zu hell — es sah
              aus wie ein aufgeklappter Kasten aus einem helleren
              Thema. 78 Prozent davon auf Schwarz liegt zwischen
              Seitengrund und Fläche: sichtbar abgesetzt, ohne die
              Kopfzeile darüber blass wirken zu lassen.
            */
            background: "color-mix(in srgb, var(--surface-1) 78%, #000)",
          }}
          onMouseLeave={schliesseBald}
          /*
            Ein schwebendes Feld, nicht eine Bank über die ganze Breite.
            
            Randlos sah es aus wie ein zweiter Kopfbereich, der sich
            über die Seite schiebt — bei drei Spalten stand rechts die
            halbe Breite leer und war trotzdem eingefärbt.
            
            `w-max` macht es so breit wie sein Inhalt und nicht
            breiter; `max-w` fängt den Fall ab, dass eine Spalte
            wächst. Mittig unter der Zeile, weil die Zeile selbst
            mittig steht.
            
            Oben keine Ecken und keine Kante: Dort schliesst es an die
            Kopfzeile an und soll aussehen, als hinge es an ihr.
          */
          /*
            Rundum abgerundet und ein Stück unter der Kopfzeile.
            
            Vorher sass es bündig an ihrer Unterkante, mit geraden
            Ecken oben — dann sieht es aus wie eine Verlängerung der
            Leiste. Mit Abstand und Rundung ist es ein eigenes Feld,
            das darunter hängt.
            
            Die sechs Pixel Abstand sind zugleich die Strecke, die die
            Maus überqueren muss. Deshalb hält `onMouseLeave` mit einer
            kurzen Frist offen — ohne sie schliesst es genau in dieser
            Lücke.
          */
          className="absolute top-[calc(100%+6px)] z-10 hidden w-max max-w-[min(1120px,calc(100vw-3rem))] rounded-(--radius-lg) border border-line shadow-xl md:block"
        >
          <div className="grid grid-flow-col auto-cols-max">
            {BEREICHSMENUE[menue].map((spalte) => (
              /*
                Haarlinie zwischen den Spalten, wie in der Vorlage —
                aber nicht vor der ersten. `first:border-l-0` statt
                eines Index-Vergleichs: Die Regel steht dort, wo sie
                gilt.
              */
              <div
                key={spalte.titel}
                className="grid content-start gap-1 border-l border-line px-6 py-7 first:border-l-0"
              >
                <h2 className="mb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3">
                  {spalte.titel}
                </h2>
                <ul className="grid gap-0.5">
                  {spalte.eintraege.map((e) => (
                    <li key={e.ziel + e.text}>
                      <Link
                        href={e.ziel}
                        onClick={schliesseGleich}
                        className="grid gap-0.5 rounded-(--radius-control) px-2 py-2 transition-colors hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <span className="text-[15px] text-ink">{e.text}</span>
                        {e.hinweis ? (
                          <span className="text-[13px] leading-snug text-ink-3">{e.hinweis}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}

/**
 * Die Suche in der Kopfzeile.
 *
 * ── Warum ein Formular und kein Knopf ─────────────────────────
 *
 * Vorher öffnete ein Lupensymbol eine Befehlspalette. Das ist die
 * Bedienung eines Werkzeugs für Menschen, die es täglich benutzen —
 * auf einem Stellenmarkt tippt man in ein Feld, das man sieht.
 *
 * Als `GET`-Formular bekommt jedes Ergebnis eine eigene Adresse, die
 * man verschicken und als Lesezeichen ablegen kann, und die Suche
 * arbeitet, bevor irgendein Bündel geladen ist.
 *
 * ── Warum die Zahl in der Beschriftung steht ──────────────────
 *
 * „Suchen" sagt nichts. „Finde 2.360.000 Jobs mit Hilfe von Monday"
 * sagt, wie gross der Bestand ist und wer dabei hilft — und die Zahl
 * ist echt, sie kommt aus `bestandskennzahlen`.
 */
function Kopfsuche({
  stellenzahl,
  genau,
  proSekunde = 0,
}: {
  stellenzahl?: string;
  genau?: number;
  proSekunde?: number;
}) {
  /*
   * Der Platzhalter zählt mit der Überschrift mit.
   *
   * Beide Zahlen stehen gleichzeitig im Bild — eine, die läuft, und
   * eine, die steht, sähen aus wie zwei verschiedene Bestände.
   *
   * Dieselbe Rechnung wie in `LebendeZahl`: Startwert plus vergangene
   * Zeit mal gemessener Rate. Kein gemeinsamer Zustand zwischen
   * beiden, weil sie in verschiedenen Bäumen hängen — aber dieselbe
   * Grundlage und derselbe Takt, und damit dieselbe Zahl.
   */
  const bestand = useBestand();
  const lebend = bestand?.wert ?? null;

  /*
   * ══════════════════════════════════════════════════════════════
   * Ein kurzes Aufhellen, wenn die Zahl weiterspringt
   * ══════════════════════════════════════════════════════════════
   *
   * Die Zahl zählt hoch, seit es den `BestandProvider` gibt — nur sah
   * man es kaum. Sie steht im Platzhalter des Suchfelds, und ein
   * Platzhalter ist ein Attribut: Man kann darin keine Ziffer einzeln
   * auszeichnen und keinen Wechsel animieren.
   *
   * Was geht, ist das Feld selbst kurz heller zu stellen. `::placeholder`
   * nimmt eine Farbübergabe an, und ein Datenattribut am Formular
   * schaltet sie. Das genügt für den Zweck: Man soll nicht die Ziffer
   * lesen, die sich ändert, sondern merken, dass sich etwas ändert.
   *
   * Der Abdruck steht auf 700 Millisekunden. Kürzer wirkt es wie ein
   * Fehler in der Darstellung, länger wie ein Blinken — und die Zahl
   * springt bei rund 0,7 Stellen je Sekunde ohnehin unregelmässig.
   *
   * `springt` hängt am Wert und nicht an einem Zeitgeber: Zwei
   * Sekunden ohne neue Stelle sollen kein Aufleuchten erzeugen.
   */
  const [springt, setSpringt] = useState(false);
  const vorher = useRef<number | null>(null);
  useEffect(() => {
    if (lebend === null) return;
    if (vorher.current !== null && lebend !== vorher.current) {
      setSpringt(true);
      const uhr = setTimeout(() => setSpringt(false), 260);
      vorher.current = lebend;
      return () => clearTimeout(uhr);
    }
    vorher.current = lebend;
  }, [lebend]);

  const zahl = lebend !== null ? lebend.toLocaleString("de-DE") : stellenzahl;
  const beschriftung = zahl
    ? `Finde ${zahl} Jobs mit Hilfe von Monday`
    : "Finde Jobs mit Hilfe von Monday";

  return (
    <form
      action="/app/jobs"
      method="get"
      role="search"
      aria-label="Stellensuche"
      data-springt={springt ? "an" : undefined}
      /*
       * Nicht mehr absolut zur Seitenmitte.
       *
       * Das Feld stand auf `absolute left-1/2 w-[min(48vw,620px)]` und
       * war damit exakt mittig — und blind für alles daneben. Gemessen
       * überlappte es „Anmelden" ab 1024 Pixeln Fensterbreite, bei 768
       * um 82 Pixel. Sichtbar war das nur als Text, der unter einem
       * Knopf verschwindet; nichts lief über den Rand, nichts brach um.
       *
       * Jetzt ein Kind der Zeile: `flex-1` nimmt den Platz zwischen
       * Marke und Knöpfen, `max-w` deckelt bei 620, `mx-auto` zentriert
       * es darin. Die Mitte verschiebt sich dadurch minimal gegenüber
       * der Seitenmitte — genau um die Hälfte des Unterschieds zwischen
       * Marke und Knopfgruppe. Das ist der Preis dafür, dass sich
       * nichts mehr überlagern kann, und er ist niedriger als der
       * Fehler.
       */
      className="kopfsuche relative hidden w-full min-w-0 max-w-[620px] shrink grow basis-[620px] md:block"
    >
      <label htmlFor="kopf-stellensuche" className="sr-only">
        {beschriftung}
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-[18px] top-1/2 size-5 -translate-y-1/2 text-ink-3"
      />
      <input
        id="kopf-stellensuche"
        name="q"
        type="search"
        placeholder={beschriftung}
        autoComplete="off"
        className="h-[52px] w-full rounded-(--radius-pill) border border-line bg-surface pl-12 pr-14 text-[15px] text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      />
      {/*
        Das Mikrofon führt zu Monday, statt hier selbst aufzunehmen.
        Sprechen kann man dort bereits; ein zweites Mikrofon im Kopf
        wäre eine Attrappe, solange die Spracherkennung nicht global
        angebunden ist. Der Weg stimmt, die Zusage auch.
      */}
      <Link
        href="/app/monday"
        aria-label="Stattdessen mit Monday sprechen"
        className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-(--radius-pill) text-ink-3 transition-colors hover:bg-soft hover:text-ink"
      >
        <Mic className="size-[19px]" strokeWidth={1.7} />
      </Link>
    </form>
  );
}

/**
 * Die untere Leiste auf schmalen Geräten.
 *
 * Fünf Bereiche mit Beschriftung, weiche Kapsel für den aktiven.
 *
 * Sie liegt fest am unteren Rand, nicht im Textfluss. Vorher tat sie
 * das nicht — die Klasse `app-nav-bottom` sollte das regeln, war aber
 * nirgends definiert. Kein Fehler, keine Warnung: eine Klasse, die es
 * nicht gibt, ist im HTML nicht von einer zu unterscheiden, die nichts
 * bewirkt. Die Leiste rutschte damit ans Dokumentende und war erst
 * nach dem Durchscrollen einer langen Jobliste erreichbar — also genau
 * dann nicht, wenn man sie braucht.
 *
 * Damit sie nichts verdeckt, hält `--nav-bottom-h` unten im
 * Inhaltsbereich denselben Platz frei. Die Höhe steht an einer Stelle,
 * nicht an zweien, sonst laufen Leiste und Freiraum auseinander.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Hauptbereiche"
      className={cn(
        /*
         * `app-nav-bottom` steht hier als Kennzeichen, nicht als Stil.
         *
         * Die Klasse war einmal für CSS gedacht, das es nie gab — und
         * genau deshalb hatte die Leiste lange gar keine Positionierung.
         * Sie ist aber der Griff, an dem die Testreihe die untere
         * Navigation findet. Als sie verschwand, fiel eine Prüfung aus,
         * die nichts mit dem Fehler zu tun hatte.
         */
        "app-nav-bottom",
        "fixed inset-x-0 bottom-0 z-40 md:hidden",
        "bg-raised/95 backdrop-blur-xl",
        "pb-[env(safe-area-inset-bottom)]",
        "shadow-[0_-1px_0_rgba(16,18,26,0.06),0_-8px_24px_rgba(16,18,26,0.05)]",
      )}
    >
      <ul className="flex h-(--nav-bottom-h) items-stretch px-1 py-1.5">
        {/* `BottomNav` erscheint nur in `AppShell`, also ausschliesslich
           fuer Angemeldete. Hier ist `BEREICHE` genau richtig — die
           Besucherliste haette hier keinen Empfaenger. */}
        {BEREICHE.map((b) => {
          const aktiv = istAktiv(pathname, b.href, b.exact);
          const Icon = b.icon;
          return (
            <li key={b.href} className="flex-1">
              <Link
                href={b.href}
                aria-current={aktiv ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 rounded-(--radius-sm) text-2xs transition-colors",
                  aktiv ? "bg-lavender font-medium text-ink" : "text-ink-3",
                )}
              >
                <Icon className="size-[19px]" strokeWidth={aktiv ? 2 : 1.7} />
                {b.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
