"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, type CSSProperties } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { JobRow, type JobRowData } from "@/components/jobs/JobRow";

/**
 * Wie viele Zeilen ohne Warten erscheinen.
 *
 * Die ersten sechs blenden beim Laden gestaffelt ein; alles darunter
 * wartet, bis es ins Bild gescrollt wird.
 */
const SOFORT = 6;

/**
 * Die geteilte Ansicht.
 *
 * Links eine Liste zum Überfliegen, rechts die ausgewählte Stelle. Der
 * Wechsel läuft über einen Suchparameter, nicht über Zustand im
 * Browser: so ist jede Auswahl verlinkbar, der Zurück-Knopf tut das
 * Erwartete, und ein Neuladen zeigt dieselbe Stelle.
 *
 * Auf schmalen Geräten gibt es kein Nebeneinander. Dort ist die Liste
 * die Seite, und die Auswahl schiebt die Einzelansicht darüber — mit
 * einem Weg zurück, der auch ohne Systemgeste funktioniert.
 */
export function JobSplitView({
  rows,
  zweigNamen,
  selectedId,
  explicitSelection,
  detail,
  ninaPanel,
  blaetterung,
  emptyState,
}: {
  rows: JobRowData[];
  /**
   * Welche Zeile aus welchem Suchzweig stammt — nach Stellenkennung.
   *
   * Leer bei einer gewöhnlichen Suche. Dann gibt es nichts zu
   * unterscheiden, und an den Zeilen steht nichts.
   */
  zweigNamen?: Record<string, string>;
  selectedId: string | null;
  /**
   * Hat die Person eine Stelle ausgewählt, oder ist es die
   * Vorauswahl?
   *
   * Auf breiten Geräten ist die Vorauswahl richtig: die rechte Spalte
   * wäre sonst leer. Auf schmalen ist sie falsch — dort ist die Liste
   * die Seite, und wer sie öffnet, will die Liste sehen, nicht die
   * erste Stelle. Serverseitig lässt sich die Fensterbreite nicht
   * kennen; deshalb entscheidet der Suchparameter.
   */
  explicitSelection: boolean;
  detail: React.ReactNode;
  /**
   * Mondays Spalte.
   *
   * Als Knoten hereingereicht, nicht hier gebaut: Die Daten dafür —
   * Passung, Gehaltsvergleich, Unternehmen — liegen auf dem Server,
   * und `JobSplitView` ist eine Client-Komponente. Sie hereinzureichen
   * spart den zweiten Weg über eine Schnittstelle für Daten, die beim
   * Seitenaufbau ohnehin schon dastehen.
   */
  ninaPanel?: React.ReactNode;
  /** Der Nachlade-Fühler — gehört IN die Liste, nicht darunter. */
  blaetterung?: React.ReactNode;
  emptyState: React.ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const listRef = useRef<HTMLDivElement>(null);

  function hrefFor(id: string): string {
    const next = new URLSearchParams(params.toString());
    next.set("job", id);
    return `/app/jobs?${next.toString()}`;
  }

  function backHref(): string {
    const next = new URLSearchParams(params.toString());
    next.delete("job");
    const search = next.toString();
    return search ? `/app/jobs?${search}` : "/app/jobs";
  }

  /*
   * Die Auswahl in den sichtbaren Bereich holen — aber nur, wenn sie
   * wirklich ausserhalb liegt. Ein Sprung bei jedem Klick wäre unruhig.
   *
   * ── Gemessen wird gegen das FENSTER, nicht gegen die Liste ──
   *
   * Hier stand der Vergleich gegen `listRef.getBoundingClientRect()`.
   * Das war richtig, solange die Liste eine feste Höhe hatte und in
   * sich rollte: Dann war ihr Kasten der sichtbare Ausschnitt.
   *
   * Seit die Liste ihre natürliche Länge hat, ist ihr Kasten so hoch
   * wie sie selbst — jede Zeile liegt darin, auch die tausend Pixel
   * unter dem Bildrand. Die Bedingung wurde damit nie wahr, und die
   * Nachführung hörte still auf zu arbeiten. Ein Fehler, den man
   * nicht sieht: Es passiert einfach nichts mehr.
   */
  /*
   * ══════════════════════════════════════════════════════════════
   * Jede Stelle erscheint, wenn sie ins Bild kommt
   * ══════════════════════════════════════════════════════════════
   *
   * Die Staffelung beim Laden allein reicht nicht: Eine Zeile ist 230
   * Pixel hoch, in einem 900 Pixel hohen Fenster stehen genau ZWEI.
   * Von einer Bewegung über zwölf Zeilen sieht man also zwei — der
   * Rest läuft unter dem Bildrand ab und ist vorbei, bevor man
   * hinscrollt.
   *
   * Deshalb wartet, was unten steht. Der Beobachter nimmt die Sperre
   * weg, sobald eine Zeile ins Bild kommt, und dann läuft ihr
   * Auftritt — eine nach der anderen, im Takt des Scrollens.
   *
   * ── Warum die Sperre aus JavaScript kommt und nicht aus CSS ──
   *
   * Weil eine Liste, die ohne JavaScript unsichtbar bleibt, keine
   * Liste ist. Stünde `opacity: 0` im Stylesheet, wäre jede Stelle
   * weg, sobald der Beobachter nicht läuft — bei einem Skriptfehler,
   * in einem alten Browser, bei abgeschaltetem JavaScript. So herum
   * ist der schlechteste Fall eine Liste ohne Animation.
   *
   * `rootMargin: -40px` löst kurz BEVOR die Zeile den Rand berührt
   * aus, nicht danach: Sonst sieht man den ersten Moment der
   * Einblendung nicht mehr, weil er noch ausserhalb liegt.
   */
  useEffect(() => {
    const liste = listRef.current;
    if (!liste) return;

    const zeilen = () => liste.querySelectorAll<HTMLElement>(".zeile-auftritt[data-wartet]");
    const frei = (el: Element) => el.removeAttribute("data-wartet");

    /*
     * Ohne Beobachter oder ohne Bewegungswunsch: alles sofort zeigen.
     *
     * Eine Liste, die auf eine Animation wartet, die nie kommt, ist
     * keine Liste. Der schlechteste Fall muss „ohne Animation" sein,
     * nicht „ohne Stellen".
     */
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      for (const z of zeilen()) frei(z);
      return;
    }

    /*
     * Der Beobachter muss auf den RICHTIGEN Rahmen schauen.
     *
     * Die Liste rollt nicht mit der Seite, sondern in einem eigenen
     * Kasten: `div.ohne-rollbalken` mit `overflow-y: auto`, gemessen
     * 892 Pixel hoch bei 5460 Pixeln Inhalt. Ein Beobachter ohne
     * `root` vergleicht mit dem Fenster — und für ihn kam keine der
     * neunzehn gesperrten Zeilen je ins Bild, egal wie weit man
     * scrollte. Gemessen: null Meldungen, und erst der Notausgang
     * nach vier Sekunden zeigte alle auf einmal.
     */
    let rahmen: Element | null = liste;
    while (rahmen) {
      const stil = getComputedStyle(rahmen);
      if (/(auto|scroll)/.test(stil.overflowY) && rahmen.scrollHeight > rahmen.clientHeight + 1) break;
      rahmen = rahmen.parentElement;
    }

    let notausgang = 0;
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        /*
         * Der erste Aufruf beweist, dass der Beobachter arbeitet.
         *
         * Ein `IntersectionObserver` meldet sich für jedes beobachtete
         * Element einmal sofort — auch wenn es nicht im Bild ist.
         * Kommt diese Meldung, ist der Notausgang unnötig, und er
         * MUSS weg: Sonst deckt er nach vier Sekunden alles auf, was
         * bis dahin nicht gescrollt wurde, und der Auftritt beim
         * Scrollen findet nie statt.
         */
        window.clearTimeout(notausgang);
        for (const e of eintraege) {
          if (!e.isIntersecting) continue;
          frei(e.target);
          beobachter.unobserve(e.target);
        }
      },
      /*
       * `-40px` löst kurz BEVOR die Zeile den Rand berührt aus, nicht
       * danach: Sonst beginnt die Einblendung noch ausserhalb und der
       * erste Moment ist nicht zu sehen.
       */
      { root: rahmen, rootMargin: "-40px 0px -40px 0px" },
    );

    for (const z of zeilen()) beobachter.observe(z);

    /*
     * Ein Riegel gegen den stillen Ausfall.
     *
     * Wenn der Beobachter aus irgendeinem Grund nicht auslöst — ein
     * Fehler, ein Sonderfall im Browser —, sind die Stellen nach vier
     * Sekunden trotzdem da. Lieber eine Liste ohne Auftritt als eine
     * leere Seite.
     */
    notausgang = window.setTimeout(() => {
      for (const z of zeilen()) frei(z);
    }, 4000);

    return () => {
      beobachter.disconnect();
      window.clearTimeout(notausgang);
    };
    /*
     * Abhängig von der ANZAHL, nicht von der Liste selbst.
     *
     * `rows` ist bei jeder Neuzeichnung ein neues Feld. Mit ihm als
     * Abhängigkeit baute dieser Effekt den Beobachter ständig neu ab
     * und auf — und ein Beobachter, der abgebaut wird, bevor er zum
     * ersten Mal gemeldet hat, meldet nie. Gemessen wurde dann keine
     * einzige Zeile aufgedeckt; erst der Notausgang nach vier
     * Sekunden zeigte alle auf einmal.
     */
  }, [rows.length]);

  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-job-id="${selectedId}"]`);
    if (!(el instanceof HTMLElement)) return;

    const item = el.getBoundingClientRect();
    const ausserhalb = item.top < 0 || item.bottom > window.innerHeight;
    if (ausserhalb) el.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  if (rows.length === 0) return <>{emptyState}</>;

  return (
    /*
     * Keine Außenumrandung, keine gemeinsame weiße Karte.
     *
     * Vorher lagen Liste und Detail in einem Rechteck mit 1-Pixel-Rand
     * — die klassische Datenbankoberfläche. Jetzt sind es zwei Flächen
     * nebeneinander, getrennt durch Abstand statt durch eine Linie: die
     * Liste liegt auf dem Seitengrund, das Detail auf einer eigenen
     * hellen Fläche.
     *
     * 40/60 statt 26rem fest: die Vorgabe verlangt, dass das Detail
     * mehr Raum bekommt als die Liste.
     */
    /*
     * ── Keine feste Höhe mehr für die Liste ──────────────────
     *
     * Sie stand erst bei `100dvh - 12rem`, dann bei `- 8rem`. Beides
     * war ein Fenster mit eigenem Rollbalken: Die Liste begann aber
     * nicht oben am Bildschirm, sondern unter Kopfzeile, Titel,
     * Eingabefeld und Zahlenzeile — ihr unteres Ende lag damit immer
     * unter dem Bildrand. Man scrollte die Seite, um an den
     * Rollbalken der Liste zu kommen, und scrollte dann noch einmal.
     *
     * Jetzt nimmt die Liste ihre natürliche Länge. Wer scrollt,
     * bekommt Stellen — nicht das Ende eines Kastens. Und alles, was
     * nach der Liste kommt, rückt entsprechend nach unten.
     *
     * ── Warum die Auswahl trotzdem stehen bleibt ─────────────
     *
     * Der Grund für die feste Höhe war richtig: Ohne sie wandert die
     * ausgewählte Stelle rechts aus dem Bild, sobald man links
     * weiterblättert. Das löst `sticky` besser — die rechte Spalte
     * bleibt am oberen Rand kleben und rollt bei Bedarf in sich,
     * während links die Liste weiterläuft.
     */
    /*
     * Zwei Spalten, 40 zu 60 — der Stand, der sich bewährt hat.
     *
     * Hier standen zwischenzeitlich drei Spalten mit anteiligen
     * Breiten. Gemessen ergab das bei 1440 Pixeln — der verbreitetsten
     * Laptopbreite — gar keine dritte Spalte, weil der Haltepunkt bei
     * 1536 lag, und bei 1600 eine Mitte von 640 Pixeln neben Nachbarn
     * von 416 und 432. Die Mitte war damit kaum grösser als ihre
     * Nachbarn, obwohl sie die Hauptfläche sein sollte.
     *
     * `minmax(0, …)` bleibt an beiden Spalten: Eine Rasterspalte hat
     * standardmässig `min-width: auto` und wächst mit ihrem Inhalt.
     * Ein langer Stellentitel schob die Liste einmal auf 881 Pixel in
     * einem 390 Pixel breiten Fenster, und die ganze Seite rollte
     * seitlich.
     */
    /*
     * `rastpunkt`: Hier ruht die Seite.
     *
     * Siehe `.rastpunkt` in globals.css — die Aufteilung ist der
     * Punkt, zu dem eine beiläufige Radbewegung zurückfällt.
     */
    <div className="rastpunkt uebergang-stellen-liste grid gap-6 lg:grid-cols-[minmax(0,40fr)_minmax(0,60fr)] lg:items-start">
      {/* ── Liste ──────────────────────────────────────────── */}
      <div
        ref={listRef}
        className={cn(
          // `min-w-0` ist hier keine Feinheit: eine Rasterspalte hat
          // standardmäßig `min-width: auto` und wächst mit ihrem Inhalt.
          // Ein langer Jobtitel schob die Liste auf 881 Pixel in einem
          // 390 Pixel breiten Fenster — die ganze Seite scrollte seitlich.
          /*
           * Die Liste rollt in einem Bereich, die Seite darunter geht
           * normal weiter.
           *
           * Ohne Grenze wuchs sie mit jedem Nachladen ins
           * Unendliche, und alles danach — Abo-Kasten, Erklärung —
           * rückte immer weiter weg. Mit Grenze bleibt das Blättern
           * an einer Stelle und der Rest der Seite erreichbar.
           *
           * `7rem` Höhe UND eine Linie unten — und der Weg dahin ist
           * die Begründung:
           *
           *   12rem: zu viel abgeschnitten, 80 Pixel toter Rand.
           *    7rem: mehr Inhalt, aber die Abgrenzung war weg.
           *   10rem: Abgrenzung da, dafür wieder weniger zu sehen.
           *
           * Der Denkfehler steckte in der Annahme, die Abgrenzung
           * müsse aus leerem Raum entstehen. Muss sie nicht: Eine
           * Linie am unteren Rand sagt „hier endet die Liste"
           * deutlicher als achtzig Pixel Nichts — und kostet einen
           * Pixel statt achtzig.
           *
           * Also beides: die Höhe für den Inhalt und `border-b` für
           * die Aussage.
           *
           * Der Abzug ist mehrfach nachgestellt worden — 12rem, 7rem,
           * 10rem, 5rem, 3rem, 1.5rem — und steht jetzt bei 0.5rem.
           *
           * Damit ist die Reihe zu Ende. Der Kasten beginnt unterhalb
           * der Kopfzeile der Seite, seine Höhe misst aber vom oberen
           * Fensterrand; sein unterer Rand liegt deshalb ohnehin schon
           * unter dem Sichtfeld und wird erst beim Rollen sichtbar.
           * Noch weniger abzuziehen ändert nichts mehr an dem, was man
           * ohne Rollen sieht — wer mehr will, muss die Kopfzeile über
           * der Liste flacher machen, damit der Kasten weiter oben
           * beginnt. Jede Verkleinerung
           * zieht die Linie weiter nach unten und zeigt mehr Stellen;
           * jede Vergrösserung grenzt schärfer ab. Wer ihn ändert,
           * ändert genau diese Abwägung und nichts anderes.
           *
           * ── Ab `md`, nicht erst ab `lg` ───────────────────
           *
           * Vorher hing alles an `lg:` — Höhe, Rollbereich und Linie
           * zusammen. Unter 1024 Pixeln fiel damit nicht nur die
           * Spaltenteilung weg, sondern die Begrenzung selbst: Die
           * Liste lief ungebremst die Seite hinunter, alle Einträge
           * untereinander, ohne Linie am Ende.
           *
           * Die Spaltenteilung braucht die Breite wirklich und bleibt
           * bei `lg`. Die Begrenzung braucht sie nicht — ein Fenster
           * von 800 Pixeln kann eine begrenzte Liste zeigen — und
           * beginnt deshalb bei `md`. Auf dem Telefon bleibt es beim
           * gewöhnlichen Seitenlauf; dort ist eine Box mit eigenem
           * Rollbereich das Falsche.
           *
           * `ohne-rollbalken` nur links: Bei fünfundzwanzig Zeilen
           * steht dort dauerhaft ein grauer Streifen mitten in der
           * Liste. Gerollt wird unverändert — mit Rad, Finger und
           * Tastatur. Rechts bleibt der Balken sichtbar: Dort ist er
           * die einzige Auskunft darüber, dass unter dem sichtbaren
           * Text noch etwas kommt.
           *
           * Der Fühler zum Nachladen sitzt IN diesem Bereich (siehe
           * `blaetterung`) — sonst bekäme er vom Rollen darin nichts
           * mit.
           *
           * `overscroll-contain`: Am Ende der Liste hört das Rollen
           * auf, statt auf die Seite überzugehen. Ohne die Regel nahm
           * das Rad, sobald oben oder unten Schluss war, die ganze
           * Seite mit — und man stand unvermittelt bei Mondays Panel,
           * das unter beiden Spalten liegt. Wer dorthin will, rollt
           * die Seite neben der Aufteilung oder scrollt am Rand.
           */
          "min-w-0 ohne-rollbalken md:max-h-[calc(100dvh_-_0.5rem)] md:overflow-y-auto md:overscroll-contain md:border-b md:border-line lg:pr-2",
          explicitSelection && "hidden lg:block",
        )}
      >
        <h2 className="sr-only">Gefundene Stellen</h2>
        {/* `min-w-0` auf Liste UND Eintrag: ein Rasterelement hat
              standardmäßig `min-width: auto` und wächst mit seinem
              Inhalt. Ein langer Jobtitel schob die Liste auf 881 Pixel
              in einem 390 Pixel breiten Fenster. */}
        {/* `gap-2.5` statt `gap-1`: Vier Pixel waren zu wenig, um zwei
            berandete Karten als zwei zu lesen — sie sahen aus wie
            Zeilen einer Tabelle. Zehn Pixel trennen sie, ohne die
            Liste auseinanderzuziehen. */}
        <ul className="grid min-w-0 gap-2.5">
          {rows.map((row, rang) => (
            <li
              key={row.id}
              data-job-id={row.id}
              className="zeile-auftritt min-w-0"
              /*
               * Der Rang steuert die Verzögerung — siehe
               * `.zeile-auftritt` in globals.css.
               *
               * Er wird bei elf gekappt: Bei fünfundvierzig
               * Millisekunden je Zeile wäre die sechzigste sonst erst
               * nach zweieinhalb Sekunden da. Was ohnehin unter dem
               * Bildrand liegt, muss nicht warten — gestaffelt
               * erscheint, was man sieht.
               */
              /*
               * Was weiter unten steht, wartet — und die Sperre steht
               * schon im HTML.
               *
               * Sie erst im Browser zu setzen war der Fehler: Ein
               * Effekt läuft NACH dem ersten Bild, und bis dahin war
               * die Einblendung längst gelaufen. Gemessen stand jede
               * Zeile auf voller Deckkraft, bevor die Sperre griff.
               *
               * Sechs, weil bei 230 Pixeln Zeilenhöhe selbst auf einem
               * hohen Bildschirm nicht mehr ins Bild passt. Alles
               * darüber hinaus bekommt seinen Auftritt beim Scrollen.
               */
              {...(rang >= SOFORT ? { "data-wartet": "" } : {})}
              style={{ "--rang": Math.min(rang, SOFORT - 1) } as CSSProperties}
            >
              <JobRow
                job={row}
                selected={row.id === selectedId}
                href={hrefFor(row.id)}
                zweig={zweigNamen?.[row.id]}
              />
            </li>
          ))}
        </ul>
        {blaetterung}
      </div>

      {/* ── Auswahl ────────────────────────────────────────── */}
      <div
        className={cn(
          /*
           * ── Eigener Rollbereich, wie links ───────────────────
           *
           * Beide Spalten sind abgegrenzt und rollen für sich: links
           * die Liste, die beim Rollen unendlich nachlädt, rechts die
           * Stelle. Die Seite darunter bleibt erreichbar, weil keine
           * der beiden ins Unendliche wächst.
           *
           * Dieselbe Höhe wie links — sonst enden sie auf
           * verschiedenen Linien, und das sieht aus wie ein Fehler.
           *
           * Ist die Stelle kürzer als der Bereich, gibt es hier
           * nichts zu rollen. Das ist richtig so und kein Fehler:
           * Dann steht alles im Bild.
           *
           * `overscroll-contain` wie links: Das Rad bleibt in dieser
           * Spalte. Vorher ging es an ihrem Ende auf die Seite über,
           * und die trägt unter der Aufteilung Mondays Panel — man
           * landete dort, ohne es zu wollen.
           *
           * `pb-10` ist der Rest aus einem früheren Anlauf und bleibt:
           * Ohne Luft am Ende steht der letzte Knopf bündig an der
           * Schnittkante und liest sich als abgeschnittener Balken.
           *
           * Erst dadurch wirkt auch der klebende Kopf richtig: Er
           * klebt an der Oberkante DIESES Bereichs, nicht am Fenster
           * — Titel, Gehalt und Knöpfe bleiben also stehen, während
           * man in der Stelle nach unten liest.
           */
          "min-w-0 md:max-h-[calc(100dvh_-_0.5rem)] md:overflow-y-auto md:overscroll-contain md:border-b md:border-line lg:pl-1 lg:pb-10",
          !explicitSelection && "hidden lg:block",
        )}
      >
        {selectedId ? (
          <>
            <h2 className="sr-only">Ausgewählte Stelle</h2>
            <div className="sticky top-0 z-10 bg-page/90 px-4 py-2.5 backdrop-blur lg:hidden">
              <button
                type="button"
                onClick={() => router.push(backHref(), { scroll: false })}
                className="inline-flex min-h-9 items-center gap-1.5 text-sm text-ink-2"
              >
                <ArrowLeft className="size-4" strokeWidth={1.8} />
                Alle Stellen
              </button>
            </div>
            {detail}
          </>
        ) : (
          <div className="hidden h-full place-items-center p-10 lg:grid">
            <p className="max-w-[26rem] text-center text-sm leading-relaxed text-ink-3">
              Wähle links eine Stelle. Rechts steht dann, warum sie passt, was dagegen spricht und
              was die Anzeige verschweigt.
            </p>
          </div>
        )}
      </div>

      {/* ── Monday ───────────────────────────────────────────── */}
      {ninaPanel && selectedId ? (
        <div
          className={cn(
            /*
             * Über die volle Breite unter beiden Spalten.
             *
             * Als dritte Spalte hat es nicht getragen: Bei 1200 Pixeln
             * bleiben nach Liste und Anzeige keine 400 übrig, und mit
             * weniger ist die Gegenüberstellung zweier Stellen nicht
             * lesbar. Unter der Seite hat Mondays Panel die volle Breite
             * und die Spalten darüber ihr gewohntes Verhältnis.
             */
            "min-w-0 lg:col-span-2",
            !explicitSelection && "hidden lg:block",
          )}
        >
          {ninaPanel}
        </div>
      ) : null}
    </div>
  );
}
