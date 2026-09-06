"use client";

import Link from "next/link";
import { AlertTriangle, Building2, Check, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  AMPELTON,
  ampelstufe,
  bandAusScore,
  zeilenampel,
} from "@/lib/jobs/befundton";
import { MerkKnopf } from "@/app/app/jobs/MerkKnopf";

/**
 * Eine Stelle in der linken Spalte.
 *
 * Bewusst eine Zeile, keine Karte. Eine Liste, die man überfliegt,
 * braucht gleiche Zeilenhöhen und einen ruhigen linken Rand — jede
 * Karte mit eigenem Rahmen zerschneidet genau das.
 *
 * Sieben Angaben, mehr nicht: Titel, Unternehmen, Ort, Arbeitsmodell,
 * Gehalt (nur wenn genannt), Alter, Passung. Der Rest steht rechts.
 */

export interface JobRowData {
  id: string;
  title: string;
  /**
   * Die amtliche Berufskennung, wo sie an der Stelle steht.
   *
   * Sie entscheidet über das Symbol links. Ohne sie steht dort ein
   * neutraler Koffer — das sagt nichts Falsches.
   */
  kldb?: string | null;
  companyName: string;
  location: string;
  workModel: string;
  contractType: string | null;
  salaryLabel: string | null;
  ageLabel: string | null;
  isFresh: boolean;
  sourceName: string;
  score: number | null;
  band: string;
  /** Jobqualität aus der Anzeige — trägt, solange die Passung fehlt. */
  qualitaet?: number | null;
  /** Woher die Gehaltszahl stammt, in zwei Wörtern. */
  salaryHerkunft?: string | null;
  /**
   * Die Referenzspanne für Stellen ohne eigene Gehaltsangabe.
   *
   * Getrennt von `salaryLabel`, damit die Zeile eine Schätzung nicht
   * wie eine Zusage setzen kann. Der Unterschied darf nicht an einem
   * Kürzel daneben hängen.
   */
  referenzSpanne?: string | null;
  referenzQuelle?: "entgeltatlas" | "bundesagentur" | null;
  /** Ob sie zugesagt ist oder eine Vermutung. */
  salaryZugesagt?: boolean;
  confidence: "high" | "medium" | "low";
  /** 0 bis 100 — der gerechnete Wert hinter der Stufe. Geht in die Farbe ein. */
  sicherheitWert?: number | null;
  /** Höchstens zwei kurze Signale. Siehe lib/jobs/listensignale.ts. */
  signale: { text: string; art: "gut" | "achtung" | "neutral" }[];
  blocked: boolean;
  /**
   * Bedingungen, zu denen diese Anzeige nichts sagt.
   *
   * Leer heisst: alles, was festgelegt wurde, ist belegt erfüllt. Der
   * Unterschied muss in der ZEILE stehen und nicht erst auf der
   * Detailseite — sonst sieht eine ungeprüfte Stelle in der Liste
   * genauso aus wie eine geprüfte, und die Entscheidung, sie
   * anzuklicken oder zu überblättern, fällt auf falscher Grundlage.
   */
  offeneBedingungen: string[];
  saved: boolean;
}

const WORK_MODEL: Record<string, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  on_site: "Vor Ort",
};

export function JobRow({
  job,
  selected,
  href,
}: {
  job: JobRowData;
  selected: boolean;
  href: string;
}) {
  /*
   * Passung, wenn es sie gibt — sonst Jobqualität.
   *
   * Beides sind Zahlen von 0 bis 100 und bedeuten Verschiedenes. Was
   * gerade gezeigt wird, steht deshalb als Wort daneben; eine nackte
   * Zahl, die mal das eine und mal das andere meint, wäre schlimmer als
   * gar keine.
   */
  /*
   * Oben rechts steht die Passung — nur die.
   *
   * Vorher sprang die Zahl auf die Anzeigenqualität um, sobald keine
   * Passung berechenbar war. Zwei verschiedene Grössen an derselben
   * Stelle, unterschieden nur durch ein Wort darunter: Wer die Liste
   * überfliegt, liest „78" und denkt Passung, auch wenn „Qualität"
   * darunter steht.
   *
   * Die Qualität hat jetzt ihre eigene Leiste. Ohne Passung bleibt die
   * Stelle hier leer — das ist die ehrliche Anzeige für „dazu kann ich
   * nichts sagen".
   */

  /*
   * Die Farbe der Zeile kommt aus Passung UND Anzeigenqualität.
   *
   * Vorher war sie blau, wenn gewählt, und sonst farblos — sie sagte
   * über die Stelle nichts. Jetzt trägt der Rand die Aussage: grün,
   * wenn beides stimmt; gelb, wenn die Passung gut und die Anzeige
   * dünn ist; rot, wenn beides schwach ist.
   *
   * Nur der Rand, keine Fläche. Gefüllte Zeilen haben diese Liste
   * schon einmal in einen einzigen Farbblock verwandelt — bei
   * fünfundzwanzig Einträgen liest man dann keine einzelne mehr.
   */
  /*
   * Dieselbe Rechnung wie im Kopf der Anzeige.
   *
   * 0,5 Passung + 0,3 Anzeigenqualität + 0,2 Sicherheit, und grün erst
   * ab 75, wenn kein Einzelwert unter 50 liegt. Die Farbe der Zeile
   * ist damit nicht geschätzt, sondern gerechnet — und dieselbe
   * Stelle ist links und rechts gleich eingefärbt.
   */
  const ampel = zeilenampel(job.score, job.qualitaet ?? null, job.sicherheitWert ?? null);

  /*
   * Oben rechts steht der Fit Score — die zusammengesetzte Zahl.
   *
   * Nicht die reine Passung: Die Farbe des Kastens entsteht aus allen
   * dreien, und eine Zahl daneben, die aus nur einem davon stammt,
   * erklärt die Farbe nicht — sie widerspricht ihr gelegentlich.
   *
   * Die Bestandteile stehen rechts im Kopf der Anzeige.
   */
  const wert = ampel.gesamt;

  /* Das Wort zur Einstufung — nur noch für Screenreader gebraucht. */
  const band = bandAusScore(wert);

  return (
    <div
      aria-current={selected ? "true" : undefined}
      /*
       * Weiche Zeilen statt Karten mit Kante.
       *
       * Kein linker Balken: ein 2-Pixel-Streifen ist die Form, die
       * Tabellenwerkzeuge benutzen, und sie macht aus einer Liste ein
       * Gitter.
       *
       * Die Lavendelfläche allein war allerdings zu leise. Neben einer
       * gefüllten Detailspalte war nicht mehr auf einen Blick zu sehen,
       * welche der 25 Zeilen gerade rechts steht — und das ist die
       * einzige Frage, die diese Liste beantworten muss, während man
       * sie durchgeht.
       *
       * Dazugekommen ist deshalb ein Ring nach innen, in der
       * Akzentfarbe bei einem Viertel Deckkraft. Er umschliesst die
       * ganze Zeile statt sie anzustreichen, liegt innen und verschiebt
       * damit nichts, und er ist leise genug, dass er neben der Fläche
       * nicht als zweite Auszeichnung auffällt.
       */
      /*
       * ── Umrandung ja, gefüllte Fläche nein ───────────────────
       *
       * Zwei Fehler nacheinander, und der zweite war meiner:
       *
       * Zuerst hatte die Zeile weder Rand noch Fläche — durchsichtig,
       * sichtbar erst beim Überfahren. Auf dunklem Grund standen damit
       * fünfundzwanzig Stellen ohne erkennbare Grenze untereinander.
       *
       * Die Korrektur war `bg-surface` mit Rand. Damit war die einzelne
       * Zeile klar — aber bei vier Pixeln Abstand verschmolzen
       * fünfundzwanzig gefüllte Karten zu EINER durchgehenden Fläche,
       * die den halben Bildschirm einnahm. Aus fehlender Trennung war
       * ein grosser Kasten geworden.
       *
       * Jetzt trägt die Zeile nur ihren Rand. Der trennt sie von der
       * nächsten, ohne dass eine Fläche entsteht; der Seitengrund
       * läuft zwischen den Karten durch. Gefüllt wird nur, was gerade
       * ausgewählt ist oder unter dem Zeiger liegt — dort ist die
       * Fläche eine Aussage und keine Grundierung.
       */
      className={cn(
        /*
         * Schmaler und dafür höher.
         *
         * Die Spalte ist von 38 auf 31 Anteile geschrumpft — bei 1600
         * Pixeln Gesamtbreite sind das rund 480 statt 590. Ein Titel
         * braucht darin öfter zwei Zeilen, und die Angaben darunter
         * brechen früher um.
         *
         * Deshalb wächst der Innenabstand von 14 auf 18 Pixel: Eine
         * Karte, die schmaler UND enger wird, drängt — und was drängt,
         * überfliegt man nicht mehr, sondern entziffert es.
         */
        "relative block rounded-(--radius-job) border px-4 py-4.5 transition-colors duration-(--duration-fast)",
        /*
         * Die Auswahl wird gezeigt, nicht angestrichen.
         *
         * Vorher lagen drei Signale übereinander: farbiger Rand, farbige
         * Fläche und ein Ring darüber. Zusammen war die gewählte Zeile
         * ein blauer Block, der lauter war als der Text darin — und in
         * einer Liste von fünfundzwanzig Zeilen zieht das den Blick von
         * dem weg, was man gerade liest.
         *
         * Übrig bleibt der Rand in voller Farbe und eine deutlich
         * blassere Fläche. Das reicht, um die Zeile zu finden, ohne sie
         * zu überstrahlen.
         */
        /*
         * Die Auswahl zeigt sich in der Fläche, die Bewertung im Rand.
         *
         * Zwei verschiedene Aussagen, zwei verschiedene Mittel: Wo man
         * gerade steht, ist eine Sache der Oberfläche; wie gut die
         * Stelle ist, eine der Stelle. Beide über die Randfarbe zu
         * führen hiesse, dass eine gewählte schlechte Zeile aussieht
         * wie eine ungewählte gute.
         */
        /*
         * Auch die Auswahl trägt die Ampelfarbe, kein Akzentblau.
         *
         * Die gewählte Zeile war blau hinterlegt — und damit sah eine
         * gewählte schlechte Stelle aus wie eine gute. Blau ist auf
         * dieser Seite die Farbe der Bedienung, nicht der Bewertung;
         * an einer Zeile, deren ganze Aussage in der Farbe steckt, ist
         * es die falsche.
         *
         * Jetzt zeigt die Auswahl sich in der Stärke: kräftigerer Rand
         * und eine schwache Fläche IN DERSELBEN Farbe. Was die Zeile
         * sagt, ändert sich beim Anklicken nicht.
         */
        !selected && "hover:bg-soft",
        /*
         * Deutlich zurückgenommen.
         *
         * Die Ränder lagen bei 50 bis 60 Prozent Deckkraft, die
         * gewählte Zeile bekam zusätzlich eine farbige Fläche und
         * einen Ring. Bei fünfundzwanzig Zeilen untereinander ergab
         * das eine Wand aus Farbe, in der die einzelne Stelle
         * unterging — die Farbe soll die Zeile einordnen, nicht sie
         * übertönen.
         *
         * Jetzt: 30 Prozent im Ruhezustand, 60 bei der Auswahl, und
         * die Fläche nur noch als Hauch. Der Unterschied zwischen
         * grün und rot bleibt erkennbar, ohne dass die Liste laut
         * wird.
         */
        /*
         * ══════════════════════════════════════════════════════════
         * Die Farbe folgt der Zahl daneben — an den drei Schwellen
         * ══════════════════════════════════════════════════════════
         *
         *   unter 50   rot
         *   50 bis 74  gelb
         *   ab 75      grün
         *
         * Ohne jeden Wert bleibt es die neutrale Linie: „Ich weiss
         * nichts" ist keine Note.
         *
         * ── Die Deckkraft bleibt, wie sie war ───────────────────
         *
         * Ein Versuch mit voller Farbe machte die Ränder nicht
         * deutlicher, sondern verschwinden. 30 Prozent im Ruhezustand
         * und 60 bei der Auswahl sind erprobt — was hier zu ändern
         * war, war die ZUORDNUNG der Farbe, nicht ihre Stärke.
         */
        ampel.stufe === "gruen"
          ? selected
            ? "border-positive/60 bg-positive-soft/20"
            : "border-positive/30"
          : ampel.stufe === "gelb"
            ? selected
              ? "border-caution/60 bg-caution-soft/20"
              : "border-caution/30"
            : ampel.stufe === "rot"
              ? selected
                ? "border-critical/60 bg-critical-soft/20"
                : "border-critical/30"
              : selected
                ? "border-line bg-soft"
                : "border-line-2",
      )}
    >
      {/*
       * Der Link liegt ÜBER der Zeile, nicht um sie herum.
       *
       * Vorher war die ganze Zeile ein `<a>`. Damit liess sich kein
       * einziger Knopf hineinsetzen — ein `<button>` in einem `<a>`
       * ist ungültiges HTML, und welches der beiden den Klick bekommt,
       * entscheidet dann der Browser.
       *
       * Jetzt deckt ein leerer Link die Fläche ab, der Inhalt liegt
       * darüber und reicht Klicks durch (`pointer-events-none`), und
       * einzelne Bedienelemente holen sie sich mit `pointer-events-auto`
       * zurück. Das ist das übliche Muster für anklickbare Karten mit
       * eigenen Knöpfen.
       *
       * Der Text ist damit nicht mehr markierbar. Das ist der Preis,
       * und er ist hier vertretbar: Aus einer Trefferliste kopiert
       * niemand Fliesstext, und die Stelle selbst steht einen Klick
       * weiter vollständig da.
       */}
      <Link
        href={href}
        scroll={false}
        aria-label={`${job.title} bei ${job.companyName}`}
        className="absolute inset-0 z-0 rounded-(--radius-job)"
      />
      <div className="pointer-events-none relative z-[1]">
      {/*
        Kein Symbol mehr links.

        Erst stand hier ein Foto, dann ein Berufssymbol — beide mit
        derselben Aufgabe: die Zeile auflockern. Beide hatten dieselbe
        Schwäche: Bei fünfundzwanzig Zeilen untereinander sehen sie
        fast gleich aus und tragen nichts zur Unterscheidung bei. Was
        sie dagegen sicher taten, war Platz kosten — achtundvierzig
        Pixel Breite in jeder Zeile plus der Einzug darunter.

        Der Platz geht an den Titel und die Angaben.
      */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {/* 19px, halbfett — die Spanne aus §16.5. Vorher 15px:
              der Titel war kleiner als der Fliesstext daneben. */}
          {/*
            Zwei Zeilen statt einer abgeschnittenen.
            
            `truncate` schnitt lange Titel mitten im Wort ab —
            „Senior Controller (m/w/d) für den Bereich Konzern…" endete
            regelmässig vor der Angabe, um die es ging. `line-clamp-2`
            bricht auf Wortgrenzen um und lässt der Zeile die Höhe, die
            sie braucht.
          */}
          {/*
            Der Titel in Instrument Sans, 22 Pixel.
            
            Erst lief er in Manrope wie der Rest, dann kurz in Chivo
            Mono. Die Zahlenschrift war zu technisch: Bei einem
            dreizeiligen deutschen Berufstitel liest sich gleichmässige
            Zeichenbreite als Quelltext.
            
            Instrument Sans hat schmalere Grossbuchstaben und geradere
            Enden — ein langer Titel passt in weniger Zeilen und
            unterscheidet sich trotzdem deutlich vom Fliesstext
            darunter. Das ist in einer Liste aus fünfundzwanzig
            Einträgen die eigentliche Arbeit.
          */}
          <h3 className="line-clamp-2 font-titel text-[22px] font-semibold leading-snug tracking-[-0.015em]">
            {job.title}
          </h3>
          <p className="mt-1 text-[17px] text-ink-2">{job.companyName}</p>
        </div>

        {/* Der Wert steht rechts oben und nutzt Ziffern gleicher Breite:
            sonst springt die Spalte bei jeder Zeile. */}
        {/*
         * Passung und Sicherheit — und keine Farbe, die etwas behauptet.
         *
         * Hier stand `bg-critical` für niedrige Sicherheit. Auf einer
         * frischen Trefferliste war damit JEDE Zeile rot markiert, und
         * zwar für eine Lücke im eigenen Profil. Rot heisst für jeden
         * Menschen „hier stimmt etwas nicht"; die Aussage war „wir
         * wissen noch zu wenig über dich".
         */}
        <span className="shrink-0 text-right">
          {wert !== null && (
            <>
              <span
                className={cn(
                  "block font-mono text-2xl font-semibold leading-none tabular",
                  AMPELTON[ampelstufe(wert)].text,
                )}
              >
                {wert}
              </span>
              <span className="mt-0.5 block text-[10px] leading-none text-ink-3">Fit</span>
            </>
          )}
          {/*
            Hier standen drei kurze Striche für die Sicherheit.
            
            Sie sind weg: Die Sicherheit geht bereits mit 20 Prozent in
            den Fit Score darüber ein, und drei Striche daneben sind
            eine zweite Anzeige derselben Sache — in einer Form, die
            man mit nichts anderem auf dieser Seite vergleichen kann.
            
            Als Zahl steht sie rechts im Kopf der Anzeige, und für
            Screenreader unverändert in der Beschreibung darunter.
          */}
          <span className="sr-only">
            {job.score !== null ? `${band.wort}, Passung ${job.score}` : "Passung nicht berechenbar"}
            {job.qualitaet !== null && job.qualitaet !== undefined
              ? `, Qualität der Anzeige ${job.qualitaet} von 100`
              : ""}
            , Sicherheit{" "}
            {job.confidence === "high" ? "hoch" : job.confidence === "medium" ? "mittel" : "niedrig"}
          </span>

          {/*
           * Merken sitzt in der Score-Spalte, nicht darüber gelegt.
           *
           * Vorher hing der Knopf mit einem Pixelwert am rechten Rand
           * und traf die Mitte nur zufällig — bei einer einstelligen
           * Zahl stand er anders als bei einer dreistelligen. Als
           * letztes Element derselben Spalte zentriert er sich von
           * selbst unter allem, was darüber steht: Zahl, Bezeichnung
           * und Sicherheitspunkte.
           *
           * `pointer-events-auto` holt sich die Klicks vom Link
           * zurück, der unter der ganzen Zeile liegt.
           */}
          {/*
            Hier stand die Anzeigenqualität als kurze Leiste.
            
            Sie ist weg: Die Qualität steckt bereits in der Farbe der
            Zeile — mit 30 Prozent Gewicht — und ein zweites Mal
            daneben als eigener Balken macht aus einer Zeile eine
            Kennzahlentafel. Wer die Einzelwerte sehen will, findet sie
            rechts im Kopf der Anzeige.
          */}

          <span className="pointer-events-auto mt-2 flex justify-center">
            <MerkKnopf jobId={job.id} anfangsGemerkt={job.saved} />
          </span>
        </span>
      </div>

      {/* 15 statt 14 Pixel: Diese Zeile trägt Ort, Arbeitsmodell,
            Gehalt und Alter — die Angaben, nach denen in einer Liste
            entschieden wird. Sie kleiner zu setzen als den Firmennamen
            darüber hiess, das Wichtigere kleiner zu setzen. */}
        <ul className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-ink-3">
        {/*
          Ort und Gehalt stehen kräftiger als der Rest.

          Nach ihnen wird in einer Liste entschieden — Vertragsart und
          Arbeitsmodell liest man erst, wenn die beiden passen. Alles
          gleich stark zu setzen heisst, dass man jede Zeile ganz lesen
          muss, um zu wissen, ob sie einen angeht.
        */}
        <li className="flex items-center gap-1 font-medium text-ink-2">
          <MapPin className="size-3.5 shrink-0" strokeWidth={1.8} />
          {job.location}
        </li>
        <li>{WORK_MODEL[job.workModel] ?? job.workModel}</li>
        {job.contractType && <li>{job.contractType}</li>}
        {/*
         * Kursiv heisst „hier fehlt etwas".
         *
         * Eine Referenzspanne fehlt nicht — sie ist eine schwächere,
         * aber echte Auskunft. Sie kursiv zu setzen hiesse, sie mit dem
         * Leerfall in einen Topf zu werfen.
         */}
        {/*
          Ein grüner Kasten, keine grüne Schrift.
          
          Grüner Text las sich als Bewertung — „dieses Gehalt ist gut" —
          und das steht uns nicht zu: Ob 62.000 gut sind, hängt am
          Menschen, nicht an der Zahl. Ein grün hinterlegtes Feld sagt
          etwas anderes und Richtiges: Hier steht ein Gehalt.
          
          Die Schrift bleibt dunkel und damit lesbar. Der Kasten steht
          IMMER, auch bei einer Referenzspanne — das Kürzel daneben
          („amtlicher Schnitt", „Marktspanne") sagt weiterhin, woher
          die Zahl stammt. Die Farbe markiert die Angabe, das Kürzel
          bewertet ihre Belastbarkeit; das sind zwei Aufgaben und
          zwei Zeichen.
          
          Nur wenn gar nichts dasteht, gibt es keinen Kasten: Ein
          grünes Feld um „Gehalt nicht angegeben" wäre eine
          Auszeichnung für eine Lücke.
        */}
        <li
          className={
            job.salaryLabel || job.referenzSpanne
              ? /* `border`, nicht `ring`: Ein Ring liegt ausserhalb des
                   Kastens und wird von den Nachbarn in derselben
                   Flex-Zeile überlagert — sichtbar war davon fast
                   nichts. Ein Rand gehört zum Element und steht
                   immer. */
                /* Kein Grün mehr in der Liste.
                   
                   Der grüne Kasten hiess „jemand hat sich festgelegt".
                   In einer Zeile, deren ganze Farbe die Bewertung
                   trägt, liest man ihn aber als „gutes Gehalt" — und
                   das ist eine Aussage, die niemand gemacht hat. Der
                   Rand bleibt: Er hebt die Zahl heraus, ohne sie zu
                   bewerten. */
                "rounded-(--radius-pill) border border-line-2 px-3 py-1 font-semibold text-ink"
              : "italic"
          }
        >
          {job.salaryLabel ?? (job.referenzSpanne ? `ca. ${job.referenzSpanne}` : "Gehalt nicht angegeben")}
          {/*
           * Die Herkunft direkt an der Zahl.
           *
           * Nicht als eigene Zeile: Sie gehört zu diesem Betrag und zu
           * keinem anderen. Und nicht in Farbe — eine Schätzung ist
           * kein Fehler, nur eine schwächere Auskunft.
           */}
          {job.salaryLabel && job.salaryHerkunft && (
            <span
              className={cn(
                "ml-1.5 rounded-(--radius-pill) px-1.5 py-px text-[11px]",
                job.salaryZugesagt ? "bg-inset text-ink-2" : "bg-inset text-ink-3",
              )}
            >
              {job.salaryHerkunft}
            </span>
          )}
          {/*
           * Ohne dieses Kürzel wäre „ca. 38.000 – 52.000 €" eine
           * Behauptung über diese Stelle. Es ist eine über den Beruf.
           */}
          {!job.salaryLabel && job.referenzSpanne && (
            <span className="ml-1.5 rounded-(--radius-pill) bg-inset px-1.5 py-px text-[11px] text-ink-3">
              {job.referenzQuelle === "entgeltatlas" ? "amtlicher Schnitt" : "Marktspanne"}
            </span>
          )}
        </li>
        {job.ageLabel && (
          <li className={cn("flex items-center gap-1", job.isFresh && "text-positive")}>
            <Clock className="size-3.5 shrink-0" strokeWidth={1.8} />
            {job.ageLabel}
          </li>
        )}
        {/*
          Die Quelle stand im Datensatz und wurde nie angezeigt.
          
          Sie gehört in die Liste: „von wem kommt diese Anzeige" ist
          eine Frage, die sich beim Überfliegen stellt — und die
          Antwort unterscheidet eine Stelle vom Arbeitgeber selbst von
          einer, die über drei Portale gelaufen ist.
        */}
        {job.sourceName && <li className="text-ink-3">{job.sourceName}</li>}
      </ul>

      {/*
       * Zwei Etiketten, vollständig lesbar.
       *
       * Vorher zwei ganze Sätze mit `line-clamp-1` — sie brachen mitten
       * im Wort ab und sahen aus wie ein Darstellungsfehler. Ein
       * Etikett, das in die Zeile passt, sagt weniger und teilt mehr
       * mit.
       *
       * Das Symbol trägt keine eigene Aussage: die Art steht im Text.
       * Wer die Farbe nicht sieht, liest „Gehalt nicht angegeben" und
       * weiss genug.
       */}
      {job.signale.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[15px] leading-relaxed">
          {job.signale.map((s) => (
            <li key={s.text} className="flex items-center gap-1.5">
              {s.art === "achtung" ? (
                <AlertTriangle aria-hidden className="size-3 shrink-0 text-caution" strokeWidth={2} />
              ) : (
                <Check aria-hidden className="size-3 shrink-0 text-positive" strokeWidth={2.6} />
              )}
              <span className="text-ink-2">{s.text}</span>
            </li>
          ))}
        </ul>
      )}

      {(job.blocked || job.offeneBedingungen.length > 0) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {job.blocked && (
            <span className="rounded-(--radius-full) border border-critical/30 bg-critical-soft px-2 py-0.5 text-2xs text-critical">
              Ausschlusskriterium
            </span>
          )}
          {/*
           * Bewusst grau und nicht rot.
           *
           * „Die Anzeige sagt nichts zum Gehalt" ist kein Mangel der
           * Stelle und keine Warnung — es ist eine Lücke in der
           * Auskunft. Ein rotes Zeichen daraus zu machen hiesse,
           * fehlende Information als schlechte Information zu lesen,
           * und das ist genau die Verwechslung, die hier abgestellt
           * werden soll.
           */}
          {job.offeneBedingungen.map((b) => (
            <span
              key={b}
              className="rounded-(--radius-full) border border-line-2 px-2 py-0.5 text-2xs text-ink-3"
            >
              {b} nicht angegeben
            </span>
          ))}
          {/*
            Der Merken-Zustand steht jetzt oben als Symbol.

            Hier stand die Plakette „gemerkt" — als vierzehntes Element
            in einer Zeile mit Bedingungen und Warnungen. Ein Zustand,
            den man selbst gesetzt hat, gehört dorthin, wo man ihn
            setzt, und nicht unter die Befunde zur Stelle.
          */}
        </div>
      )}
      </div>
    </div>
  );
}
