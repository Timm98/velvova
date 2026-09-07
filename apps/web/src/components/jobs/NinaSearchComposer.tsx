"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Mic, MessagesSquare, SlidersHorizontal } from "lucide-react";
import { useNinaActions } from "@/components/nina/NinaProvider";
import { cn } from "@/lib/cn";
import { useSuchdialog } from "./Suchrueckfrage";
import { deuteSuchintention } from "@/lib/jobs/suchintention";

/**
 * Eine Eingabe für die Jobsuche.
 *
 * Vorher standen hier zwei, direkt untereinander:
 *
 *   „Beschreibe Monday, wonach du suchst …"
 *   „Beschreib in eigenen Worten, was du suchst …"
 *
 * Zwei Felder, die dasselbe versprechen, sind nicht doppelt so
 * hilfreich — sie sind eine Frage, die man nicht beantworten kann: in
 * welches tippe ich? Die Antwort war unterschiedlich (das eine sprach
 * mit Monday, das andere setzte einen Filter), und genau das war von
 * außen nicht zu sehen.
 *
 * Jetzt eine Eingabe, die beides tut:
 *
 *   1. Der Text geht als Filter in die URL — die Liste aktualisiert
 *      sich sofort, ohne auf ein Modell zu warten.
 *   2. Derselbe Text geht an Monday, die ihn deutet und erklärt, wonach
 *      jetzt gesucht wird.
 *
 * Die schnelle Hälfte darf nicht auf die langsame warten. Wer „Berlin"
 * tippt, soll Berliner Stellen sehen, bevor ein Sprachmodell den Satz
 * gelesen hat.
 */

/**
 * Vorschläge — und woran man erkennt, dass sie erledigt sind.
 *
 * Jeder trägt den Filterschlüssel, den er setzt. Steht der schon in der
 * Adresse, verschwindet der Vorschlag: „Nur Stellen ab 45.000 €"
 * weiterhin anzubieten, nachdem genau das gesetzt wurde, sieht aus wie
 * ein Knopf, der nicht funktioniert hat.
 *
 * `schluessel: null` heisst „lässt sich nicht erledigen" — eine offene
 * Frage an Monday bleibt immer sinnvoll.
 */
const BEISPIELE: { text: string; schluessel: string | null }[] = [
  { text: "Nur Stellen ab 45.000 €, wenn das Gehalt angegeben ist.", schluessel: "gehaltAb" },
  { text: "Maximal zwei Bürotage rund um Karlsruhe.", schluessel: "ort" },
  { text: "Nur hybrid oder remote.", schluessel: "remote" },
  { text: "Nur unbefristete Stellen.", schluessel: "contract" },
  { text: "Jobs mit Kundenkontakt, aber ohne Kaltakquise.", schluessel: "nicht" },
  { text: "Welche ungewöhnlichen Rollen passen zu mir?", schluessel: null },
];

export function NinaSearchComposer({
  assistantName,
  onOpenFilters,
  activeFilterCount,
}: {
  assistantName: string;
  onOpenFilters?: () => void;
  activeFilterCount?: number;
}) {
  const nina = useNinaActions();
  const router = useRouter();
  const params = useSearchParams();

  /*
   * Das Feld startet leer — auch wenn `q` in der Adresse steht.
   *
   * ══════════════════════════════════════════════════════════════
   * Der Fehler, den das behebt
   * ══════════════════════════════════════════════════════════════
   *
   * Es begann mit dem Suchbegriff aus der Adresse. Beim Absenden wird
   * das Feld geleert — aber jeder Neuaufbau der Seite holte den
   * Begriff zurück. Für die Person sah es aus, als bliebe ihre
   * Eingabe stehen: Sie musste sie von Hand löschen, bevor sie etwas
   * anderes tippen konnte.
   *
   * Was gesucht wird, steht als Plättchen über der Liste — sichtbar
   * und mit einem Kreuz zum Wegnehmen. Das Feld ist für das Nächste
   * da, nicht für das Letzte.
   */
  const [text, setText] = useState("");
  /*
   * Die Mikro-Bestätigung.
   *
   * `null`, solange nichts zu sagen ist. Sie verschwindet nach vier
   * Sekunden von selbst — lange genug zum Lesen, kurz genug, um nicht
   * zum dauerhaften Element zu werden.
   */
  const [bestaetigung, setBestaetigung] = useState<{ art: "ok" | "frage"; text: string } | null>(null);
  const [unterwegs, startTransition] = useTransition();
  const [laeuft, setLaeuft] = useState(false);
  const dialog = useSuchdialog();
  const feld = useRef<HTMLInputElement>(null);

  useEffect(() => {
    /*
     * Solange die Liste noch lädt, bleibt die Quittung stehen.
     *
     * Sie verschwand nach vier Sekunden — und die Stellenseite braucht
     * unter Importlast länger. Die Person sah dann ein leeres Feld,
     * keine Meldung und eine unveränderte Liste: Sie hielt die Eingabe
     * für wirkungslos und tippte erneut.
     */
    if (!bestaetigung || bestaetigung.art === "frage" || unterwegs || laeuft) return;
    /* Eine Rückfrage bleibt stehen — sie wartet auf eine Antwort. */
    const t = setTimeout(() => setBestaetigung(null), 4000);
    return () => clearTimeout(t);
  }, [bestaetigung, unterwegs, laeuft]);

  /*
   * Die Liste folgt dem ABSENDEN, nicht dem Tippen.
   *
   * ── Der Fehler, den das behebt ─────────────────────────────
   *
   * Hier stand eine entprellte Navigation auf jede Textänderung. Sie
   * war gut gemeint — die Liste folgte dem Tippen. Zusammen mit der
   * neuen Regel „nach dem Absenden leert sich das Feld" ergab sie
   * jedoch genau das Gegenteil des Gewollten:
   *
   *   absenden → Filter gesetzt, Feld geleert
   *   350 ms später → Effekt läuft mit LEEREM Text → Filter weg
   *
   * Im Browser sah das so aus: „Hab ich notiert: ab 45.000 €" —
   * und eine unveränderte Liste. Die Bestätigung stimmte, die Wirkung
   * war schon wieder gelöscht.
   *
   * ── Warum nicht nur der Effekt repariert wurde ─────────────
   *
   * Ein Flag, das den nächsten Lauf überspringt, hätte den Fall
   * geflickt. Aber die Navigation beim Tippen ist auch für sich
   * fragwürdig: Die Liste ändert sich mitten im Satz, die Chips
   * flackern, und bei „Kundenbetreuung in Berlin" sieht man drei
   * Zwischenzustände, die niemand wollte.
   *
   * Absenden ist eine Handlung. Sie darf etwas auslösen.
   */
  /*
   * Der Satz wird zu einer Adresse.
   *
   * Die von Monday gesetzten Bedingungen sind Filter, keine Suchwörter —
   * sie stehen einzeln in der URL und damit sichtbar in den Filtern
   * (§16.3). Was keine Regel erkennt, bleibt Volltext.
   *
   * Erst alle eigenen Schlüssel löschen, dann neu setzen: sonst bleibt
   * ein Filter aus dem vorigen Satz stehen, den niemand mehr im Text
   * sieht — der stille Filter, der die Liste unerklärlich leer hält.
   */
  function alsAdresse(
    deutung: { filter: Record<string, unknown>; entfernen: readonly string[] },
    aktuell: URLSearchParams,
  ): string {
    const next = new URLSearchParams(aktuell.toString());
    /*
     * `seite` gehört mit gelöscht.
     *
     * Eine neue Bedingung ergibt eine neue, meist kürzere Liste. Die
     * Seitenzahl von vorhin passt dann auf nichts mehr. Die Seite
     * klammert das inzwischen zusätzlich ab — beides ist richtig: hier
     * steht die Absicht, dort die Sicherung.
     */
    next.delete("seite");

    const { filter, entfernen } = deutung;

    /*
     * ── Änderung, nicht Ersatz ────────────────────────────────
     *
     * Hier wurden vorher ALLE Filterschlüssel gelöscht und dann neu
     * gesetzt. Jede Eingabe warf damit still weg, was vorher gesetzt
     * war: Wer „Karlsruhe" sagte und danach „unbefristet", hatte
     * Karlsruhe verloren — ohne dass es irgendwo stand.
     *
     * Jetzt ist eine Eingabe eine Änderung auf dem bestehenden
     * Zustand. Was der Satz nicht erwähnt, bleibt.
     *
     * ── Was ausdrücklich weggenommen wird ─────────────────────
     *
     * `entfernen` kommt aus Sätzen wie „mach den Gehaltsfilter wieder
     * weg". Ohne diese Zeilen war das eine Volltextsuche nach drei
     * Wörtern, die in keiner Anzeige stehen — null Treffer auf einen
     * Satz, den jeder Mensch versteht.
     */
    for (const k of entfernen) next.delete(k);

    /*
     * Ein neuer Ort hebt die alte Ortsgenauigkeit auf.
     *
     * Sonst bliebe „nur" von der vorigen Eingabe an einem Ort kleben,
     * den jemand gerade weiter gefasst hat.
     */
    if (filter.ort !== undefined && filter.ortGenau === undefined) next.delete("ortGenau");
    if (filter.umkreisKm !== undefined) next.delete("ortGenau");
    /* Eine geänderte Bedingung fängt die Liste von vorne an. */
    next.delete("anzahl");

    for (const [k, v] of Object.entries(filter)) {
      if (v === undefined || v === null || v === "") continue;
      /*
       * Wahrheitswerte als „1" und „0", nicht als „true"/„false".
       *
       * Die Filterprüfung liest `params.schicht === "0"`. Ein
       * `String(false)` hätte „false" ergeben — der Filter wäre in der
       * Adresse sichtbar gewesen und hätte nichts getan.
       */
      next.set(k, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
    }
    return next.toString();
  }

  /**
   * Eine kurze Eingabe ist ein Filter, kein Gespräch.
   *
   * ── Was hier vorher passierte ─────────────────────────────
   *
   * „Nur Stellen ab 45.000 €" öffnete den vollen Monday-Drawer, schickte
   * den Satz an das Modell und liess einen Gesprächsverlauf entstehen.
   * Für eine Einstellung, die in zwei Wörtern verstanden ist.
   *
   * Der Drawer verdeckte dabei die halbe Trefferliste — also genau
   * das, was sich gerade geändert hatte.
   *
   * ── Was jetzt passiert ────────────────────────────────────
   *
   *   verstanden  → Filter setzen, Feld leeren, kurze Bestätigung
   *   unklar      → kleine Rückfrage an derselben Stelle
   *
   * Der Drawer öffnet nur noch auf ausdrückliche Handlung — „Mit Monday
   * besprechen" oder das Gesprächssymbol.
   */
  /**
   * Absenden heisst: Monday legt die Zeile aus — mit Zusammenhang.
   *
   * ══════════════════════════════════════════════════════════════
   * Was sich gegenüber dem reinen Regelabgleich ändert
   * ══════════════════════════════════════════════════════════════
   *
   * Vorher entschied eine Musterliste im Browser, was ein Filter ist.
   * Sie kannte „ab 45.000 €" und „unbefristet" — und sonst nichts.
   * „bayern" war für sie kein Ort, „nicht in der Pflege" kein
   * Ausschluss, und „doch lieber näher dran" gar nichts, weil dafür
   * der vorige Satz gebraucht wird.
   *
   * Jetzt geht die Zeile an den Server. Dort laufen erst dieselben
   * Regeln — kostenlos und sofort — und nur der Rest geht ans Modell,
   * zusammen mit den geltenden Filtern und den letzten Sätzen.
   *
   * ── Warum das Feld sich trotzdem sofort leert ───────────────
   *
   * Weil die Handlung abgeschlossen ist, sobald jemand Enter drückt.
   * Auf die Antwort zu warten hiesse, ein Feld mit Text stehen zu
   * lassen, das nichts mehr annimmt — und das sieht aus, als sei die
   * Eingabe nicht angekommen.
   */
  async function absenden(frage: string) {
    const inhalt = frage.trim();
    if (!inhalt) return;

    setText("");
    setBestaetigung({ art: "ok", text: "liest mit" });
    setLaeuft(true);

    /*
     * Der Regelabgleich läuft auch hier — nicht für den Filter,
     * sondern für die Quittung.
     *
     * Wer „ab 45.000 €" eintippt, soll nicht eine Sekunde lang
     * „denkt kurz nach" lesen, wenn die Antwort feststeht. Der Server
     * rechnet dasselbe noch einmal; hier geht es nur um die Anzeige.
     */
    const sofort = deuteSuchintention(inhalt);
    if (sofort.erkannt.length > 0) setBestaetigung(kurzeBestaetigung(sofort.erkannt));

    /*
     * ══════════════════════════════════════════════════════════════
     * Die Liste ändert sich sofort, nicht erst nach dem Modell
     * ══════════════════════════════════════════════════════════════
     *
     * Der Modellaufruf dauert gemessen 1,6 bis 2,1 Sekunden. So lange
     * stand die Liste unverändert da, während oben „liest mit …"
     * blinkte — und in dieser Zeit tippen Menschen weiter oder halten
     * die Eingabe für verschluckt.
     *
     * Der Regelabgleich hat sein Ergebnis SOFORT. Es ist gröber: Was
     * er nicht kennt, wird zur Volltextsuche. Für „bayern" heisst das
     * `q=bayern` statt `ort=bayern` — und weil die Volltextsuche
     * Titel UND Ort durchsucht, sieht die Person praktisch dieselbe
     * Liste.
     *
     * Also: erst grob, dann genau. Die zweite Navigation korrigiert
     * das Plättchen und schärft den Filter.
     *
     * ── Warum das nicht doppelt kostet ──────────────────────────
     *
     * Die Bewertung je Person liegt 45 Sekunden im Speicher. Der
     * zweite Aufbau trifft sie, sofern sich die Filter nicht geändert
     * haben — und wenn doch, war die Änderung nötig.
     */
    const grobeSchluessel = Object.keys(sofort.filter);
    const grobeAdresse = alsAdresse(
      {
        filter: sofort.filter,
        entfernen: sofort.entfernen,
      },
      params,
    );
    startTransition(() => router.replace(`/app/jobs?${grobeAdresse}`, { scroll: false }));

    const bestehend: Record<string, string> = {};
    params.forEach((v, k) => (bestehend[k] = v));

    try {
      const antwort = await fetch("/api/jobs/deutung", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eingabe: inhalt, bestehend }),
      });

      if (!antwort.ok) throw new Error(String(antwort.status));

      const d = (await antwort.json()) as {
        filter?: Record<string, unknown>;
        entfernen?: string[];
        erklaerung?: string;
        rueckfrage?: { schluessel: string; frage: string } | null;
      };

      /*
       * Zweite Navigation nur, wenn sie etwas ändert.
       *
       * Bei „ab 45.000 €" ist das Ergebnis des Modells dasselbe wie
       * das der Regeln. Noch einmal zu navigieren hiesse, die Seite
       * ohne Anlass neu aufzubauen — sichtbar als Flackern, spürbar
       * als Ruckeln.
       */
      /*
       * ══════════════════════════════════════════════════════════
       * Was der grobe Schritt gesetzt hat, muss der feine aufräumen
       * ══════════════════════════════════════════════════════════
       *
       * Der Regelabgleich legt alles, was er nicht kennt, nach `q`.
       * Für die sofortige Liste ist das richtig — aber wenn das
       * Modell den Rest danach als Ort erkennt, steht `q` immer noch
       * in der Adresse.
       *
       * Genau so kam „hamburg" zweimal: einmal als Suchwort aus dem
       * groben Schritt, einmal als „rund um hamburg" aus dem feinen.
       * Sichtbar wurde es erst beim ZWEITEN Ort, weil beim ersten
       * beide Plättchen dasselbe Wort trugen und wie eines aussahen.
       *
       * `alsAdresse` ändert bewusst, statt zu ersetzen — sonst
       * verlöre jede Eingabe die Filter der vorigen. Also räumt hier
       * nur weg, was dieser eine Vorgang selbst gesetzt hat und was
       * die genaue Deutung nicht mehr enthält.
       */
      const feinerFilter = d.filter ?? {};
      const ueberholt = grobeSchluessel.filter(
        (k) => feinerFilter[k] === undefined || feinerFilter[k] === null,
      );

      const feineAdresse = alsAdresse(
        { filter: feinerFilter, entfernen: [...(d.entfernen ?? []), ...ueberholt] },
        params,
      );
      if (feineAdresse !== grobeAdresse) {
        startTransition(() => router.replace(`/app/jobs?${feineAdresse}`, { scroll: false }));
      }

      setBestaetigung(
        d.erklaerung ? { art: "ok", text: d.erklaerung } : { art: "ok", text: `sucht nach „${inhalt}".` },
      );

      /*
       * Die Rückfrage geht ins Fenster unten rechts — nicht hierher.
       *
       * Zwei Dinge an derselben Stelle wären eine Unterhaltung im
       * Suchfeld. Unten rechts ist der Ort für Mondays Fragen, und dort
       * gilt: eine Frage, eine Antwort, dann zu.
       */
      if (d.rueckfrage) dialog.stelle(d.rueckfrage);
    } catch {
      /*
       * Der Rückfall ist der alte Weg: Regeln im Browser.
       *
       * Er ist schlechter und er funktioniert. Eine Suchzeile, die bei
       * einem Netzfehler gar nichts tut, wäre die schlechtere Antwort
       * — die Person hat gerade etwas eingetippt und erwartet eine
       * Liste, keine Meldung über unsere Infrastruktur.
       */
      /*
       * Navigiert ist schon — die grobe Adresse steht seit dem
       * Absenden. Ein Netzfehler nimmt der Person also nicht die
       * Liste, nur die Verfeinerung.
       */
      if (sofort.erkannt.length === 0) {
        setBestaetigung({ art: "ok", text: `sucht nach „${inhalt}".` });
      }
    } finally {
      setLaeuft(false);
    }
  }

  /** Den vollen Chat gibt es nur auf ausdrückliche Handlung. */
  function mitNinaBesprechen(frage: string) {
    const inhalt = frage.trim();
    if (!inhalt) return;
    nina.setOpen(true);
    void nina.send(inhalt);
    setText("");
    setBestaetigung(null);
  }

  /*
   * Nur Vorschläge zu Themen, die noch offen sind.
   *
   * Ein Vorschlag, dessen Filter bereits gesetzt ist, ist kein Vorschlag
   * mehr — er ist eine Wiederholung dessen, was gerade passiert ist.
   *
   * ── Derzeit ohne Abnehmer ─────────────────────────────────
   *
   * Die Plättchen unter dem Feld sind entfernt (siehe unten). Die
   * Liste und diese Auswahl bleiben stehen: Sie kosten nichts, und
   * falls die Vorschläge an anderer Stelle wieder auftauchen sollen
   * — etwa erst nach einer Rückfrage von Monday —, ist es eine Zeile.
   */
  const offeneBeispiele = BEISPIELE.filter(
    (b) => b.schluessel === null || !params.get(b.schluessel),
  ).slice(0, 4);

  return (
    /* Auch hier `minmax(0,1fr)`: ein Raster mit Vorgabespur wächst auf
       die Mindestbreite seines breitesten Kindes. Bei 360 Pixeln waren
       das 351 — und die ganze Seite lief über. */
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div
        className={cn(
          "flex items-center gap-2 rounded-(--radius-pill) bg-raised py-2 pl-5 pr-2 shadow-sm",
          "transition-shadow duration-(--duration-fast)",
          "focus-within:shadow-[0_0_0_2px_var(--primary),0_10px_32px_rgba(101,93,255,0.16)]",
        )}
      >
        {/* Ein Gesprächssymbol, keine zweite Monday. Die echte Monday hat
            ein Modell; ein Ring davor wäre eine konkurrierende
            Darstellung derselben Figur. */}
        <MessagesSquare className="size-[18px] shrink-0 text-accent" strokeWidth={1.9} aria-hidden />

        <input
          ref={feld}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void absenden(text);
            }
          }}
          placeholder={`Frag ${assistantName} oder beschreibe deinen nächsten Job …`}
          aria-label={`Frag ${assistantName} oder beschreibe deinen nächsten Job`}
          className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
        />

        {onOpenFilters && (
          <button
            type="button"
            onClick={onOpenFilters}
            className="hidden h-11 items-center gap-2 rounded-(--radius-pill) px-4 text-sm text-ink-2 transition-colors hover:bg-soft hover:text-ink sm:flex"
          >
            <SlidersHorizontal className="size-4" strokeWidth={1.8} />
            Filter
            {activeFilterCount ? (
              <span className="grid size-5 place-items-center rounded-full bg-accent text-2xs font-semibold text-accent-on">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        )}

        <button
          type="button"
          aria-label="Diktieren"
          onClick={() => feld.current?.focus()}
          className="grid size-11 shrink-0 place-items-center rounded-(--radius-pill) text-ink-2 transition-colors hover:bg-soft hover:text-ink"
        >
          <Mic className="size-[18px]" strokeWidth={1.8} />
        </button>

        <button
          type="button"
          onClick={() => absenden(text)}
          disabled={text.trim().length === 0}
          aria-label={`${assistantName} fragen`}
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-(--radius-pill) transition-colors",
            text.trim().length > 0
              ? "bg-accent text-accent-on hover:bg-accent-hover"
              : "bg-soft text-ink-3",
          )}
        >
          <ArrowUp className="size-[18px]" strokeWidth={2.2} />
        </button>
      </div>

      {/*
        Die Mikro-Bestätigung.
        
        Klein, unter dem Feld, und nach vier Sekunden wieder weg. Kein
        Seitenpanel, kein Gesprächsverlauf — es ist eine Quittung, keine
        Unterhaltung.
      */}
      {bestaetigung && (
        <p
          role="status"
          /*
           * ══════════════════════════════════════════════════════
           * Eine Quittung, kein Banner
           * ══════════════════════════════════════════════════════
           *
           * Sie stand in Akzentblau über die volle Breite, mit
           * derselben Schriftgrösse wie der Fliesstext. Damit war das
           * lauteste Element auf der Seite die Bestätigung dafür,
           * dass etwas passiert ist, was man ohnehin gerade selbst
           * ausgelöst hat — und die Trefferliste darunter, um die es
           * geht, wirkte dagegen beiläufig.
           *
           * Jetzt gar kein Kasten mehr: kein Grund, kein Rahmen, keine
           * Pille. Ein kleiner Punkt und eine Zeile, direkt unter dem
           * Feld.
           *
           * ── Warum das besser ist als ein leiser Kasten ──────────
           *
           * Ein Kasten ist ein Ding auf der Seite; er hat Kanten,
           * Abstände und einen Platz, den er belegt, auch wenn er
           * nichts sagt. Eine Zeile ist eine Bemerkung. Was Monday
           * gerade tut, ist eine Bemerkung.
           *
           * ── Und warum sie blau ist und nicht grau ───────────────
           *
           * In Grau war sie eine Fussnote — auf einer Seite voller
           * grauer Nebenangaben nicht mehr zu unterscheiden von
           * „Vor Ort · Unbefristet · vor 3 Tagen".
           *
           * Das Blau der Bedienung sagt: Das hier ist keine Angabe
           * über eine Stelle, sondern das System, das gerade etwas
           * tut. Dieselbe Farbe trägt das Gesprächssymbol daneben.
           */
          className={cn(
            "flex w-fit max-w-full items-center gap-2 px-1 pt-1 text-[13px] tracking-[-0.005em] text-accent-text",
          )}
        >
          <span
            aria-hidden
            className="block size-1.5 shrink-0 rounded-full bg-accent"
            /*
              Ein einfarbiger Punkt statt eines Verlaufs.

              Der Verlauf war ein Detail, das man bei sechs Pixeln
              ohnehin nicht sieht — und drei Farben in einem Punkt
              sind drei Entscheidungen für nichts.

              Der alte Hinweis bleibt trotzdem lesenswert.

              Erste Fassung schrieb `--accent-hover` hinein — eine
              Variable, die in der Tokendatei nicht definiert ist. Der
              Abgleich hat sie sofort gemeldet; im Browser wäre sie
              stillschweigend als „durchsichtig" gerendert worden, und
              der Punkt hätte halb gefehlt.
            */
          />
          <span className="min-w-0">
            <span className="font-medium">{assistantName}</span> {bestaetigung.text}
            {/*
              Der Ladehinweis gehört an die Quittung, nicht daneben.

              Ohne ihn stand dieselbe Zeile bei einer Antwort in 200
              Millisekunden und bei einer in zwei Minuten — und im
              zweiten Fall sah es aus, als sei nichts passiert.
            */}
            {(unterwegs || laeuft) && <span className="opacity-60"> …</span>}
          </span>
          {bestaetigung.art === "frage" && (
            <button
              type="button"
              onClick={() => mitNinaBesprechen(text || bestaetigung.text)}
              className="ml-1 shrink-0 text-2xs text-accent-text underline underline-offset-[3px]"
            >
              Mit {assistantName} besprechen
            </button>
          )}
        </p>
      )}

      {/*
        Hier standen Beispielvorschläge als Plättchen — „Vertrieb in
        Karlsruhe", „mindestens 60.000 Euro" und ähnliche, anklickbar
        als Starthilfe.

        Sie sind weg. Unter einem Feld, in das man Monday in eigenen
        Worten schreibt, sind vorformulierte Sätze eine Vorauswahl:
        Man liest sie, statt zu überlegen, was man selbst sucht — und
        antwortet dann in der Form, die dort steht. Genau das soll
        dieses Feld verhindern; es ist der Unterschied zu einer
        Suchmaske mit Vorschlagsliste.

        Wonach gesucht werden kann, sagt der Platzhalter im Feld. Was
        daraus wurde, erscheint darunter als Bedingung — aber erst,
        wenn wirklich etwas gesagt wurde.
      */}
    </div>
  );
}

/**
 * Die Quittung in einem halben Satz.
 *
 * „Hab ich notiert: mindestens 45.000 €." — nicht „Was soll sich in
 * deinem nächsten Job konkret ändern? Nenne in 1–2 Sätzen …". Wer schon
 * verstanden wurde, will keine Rückfrage, sondern eine Bestätigung.
 */
function kurzeBestaetigung(erkannt: string[]): { art: "ok"; text: string } {
  const eins = erkannt[0] ?? "";
  const rest = erkannt.length - 1;
  return {
    art: "ok",
    text:
      erkannt.length === 1
        ? `hat notiert: ${eins}.`
        : `hat notiert: ${eins} und ${rest} weitere${rest === 1 ? "s" : ""}.`,
  };
}
