"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
   * Der Weg auf die Arbeitgeberseite gehört in den Kopf, nicht nur in
   * den Fuss. Wer Mitarbeiter sucht, kommt auf dieselbe Seite wie wer
   * Arbeit sucht — und soll nicht erst scrollen müssen, um zu merken,
   * dass es für ihn auch etwas gibt.
   */
  { href: "/for-business", label: "Für Unternehmen", icon: Building2 },
  { href: "/security", label: "Sicherheit", icon: ShieldCheck },
] as const;

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
}) {
  const pathname = usePathname();
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
      className="uebergang-kopf sticky top-0 z-40 border-b border-line bg-page"
    >
      {/* ── Reihe 1: Marke · Suche · Konto ─────────────────── */}
      {/*
        `relative`, weil die Suche absolut in der Mitte sitzt.
        Im Flussbild wäre sie nur *ungefähr* mittig: Links steht die
        Marke, rechts Glocke und Konto, und die beiden sind nie gleich
        breit. Ein Suchfeld, das um dreissig Pixel danebensteht, sieht
        nicht nach Zufall aus, sondern nach Nachlässigkeit.
      */}
      <div className="relative mx-auto flex h-[88px] w-full max-w-(--breite-inhalt) items-center gap-4 px-5 md:px-8">
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

        {/* ── Suche, mittig ─────────────────────────────────── */}
        <Kopfsuche stellenzahl={stellenzahl} genau={stellenGenau} proSekunde={proSekunde} />

        <div className="ml-auto flex shrink-0 items-center gap-1">
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
        className="laufband mx-auto hidden w-full max-w-(--breite-inhalt) overflow-x-auto px-5 md:flex md:px-8 lg:justify-center"
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
          <ul className="flex items-center gap-3 whitespace-nowrap pb-2.5 md:gap-5 lg:gap-8 xl:gap-12">
          {BEREICHE.map((b) => {
            const aktiv = istAktiv(pathname, b.href, b.exact);
            const Icon = b.icon;
            return (
              <li key={b.href}>
                <Link
                  href={b.href}
                  aria-current={aktiv ? "page" : undefined}
                  className={cn(
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
                    "flex h-12 items-center justify-center rounded-(--radius-control) px-3 text-[15px] transition-colors duration-(--duration-fast)",
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
                  )}
                >
                  {/*
                    Nur das Wort.

                    Die Symbole standen daneben und trugen nichts bei:
                    Ein Haus für „Heute", eine Aktentasche für „Jobs" —
                    das Wort sagt es bereits, und zwei Zeichen für
                    dieselbe Sache machen die Zeile nur unruhiger.
                    `b.icon` bleibt in der Liste stehen; die untere
                    Leiste auf schmalen Geräten braucht es weiterhin,
                    dort steht es allein.
                  */}
                  <span>{b.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
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
      className="kopfsuche absolute left-1/2 hidden w-[min(48vw,620px)] -translate-x-1/2 md:block"
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
