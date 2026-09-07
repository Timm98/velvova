"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { JobRow, type JobRowData } from "@/components/jobs/JobRow";

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
  selectedId,
  explicitSelection,
  detail,
  ninaPanel,
  blaetterung,
  emptyState,
}: {
  rows: JobRowData[];
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
    <div className="uebergang-stellen-liste grid gap-6 lg:grid-cols-[minmax(0,40fr)_minmax(0,60fr)] lg:items-start">
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
           */
          "min-w-0 ohne-rollbalken md:max-h-[calc(100dvh_-_0.5rem)] md:overflow-y-auto md:border-b md:border-line lg:pr-2",
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
          {rows.map((row) => (
            <li key={row.id} data-job-id={row.id} className="min-w-0">
              <JobRow job={row} selected={row.id === selectedId} href={hrefFor(row.id)} />
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
           * Dann steht alles im Bild. Wer trotzdem am Rad dreht,
           * bewegt die Seite — die hat unter der Aufteilung weiter
           * Inhalt.
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
          "min-w-0 md:max-h-[calc(100dvh_-_0.5rem)] md:overflow-y-auto md:border-b md:border-line lg:pl-1 lg:pb-10",
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
