import Link from "next/link";
import { AMPELTON, ampelstufe, zeilenampel } from "@/lib/jobs/befundton";
import { ExternalLink } from "lucide-react";
import {
  herkunftAusArt,
  linkTextMitZiel,
  type ConstraintResult,
  type Herkunft,
  type Job,
} from "@paycheck/domain";
import { Badge, Button } from "@/components/ui";
import { GehaltBlock } from "@/components/jobs/GehaltBlock";
import { gehaltsbefund } from "@paycheck/jobs";
import { NettoSchaetzung } from "@/components/jobs/NettoSchaetzung";
import { Bedingungsbadges } from "@/components/jobs/Bedingungsbadges";
import { Bedingungspruefung } from "@/components/jobs/Bedingungspruefung";

/**
 * Der Kopf einer Stelle — für BEIDE Detailansichten.
 *
 * Es gab zwei: die rechte Spalte der geteilten Ansicht
 * (`JobDetailPanel`) und die eigene Seite unter `/app/jobs/[id]`. Beide
 * zeigten Titel, Unternehmen, Eckdaten, Gehalt und die Aktionen — in
 * verschiedener Reihenfolge, mit verschiedenen Worten und mit
 * verschiedenem Stand.
 *
 * Das war kein Schönheitsfehler. Ein Umbau der einen liess die andere
 * unberührt, und im Browser stand danach mal das Neue und mal das Alte,
 * je nachdem, über welchen Weg jemand hingekommen war. Ein
 * Abschlussbericht konnte dann wahrheitsgemäss „umgesetzt" melden und
 * trotzdem falsch sein.
 *
 * Deshalb steht die Reihenfolge jetzt genau einmal hier:
 *
 *   1. Bild — das erste sichtbare Element der Stelle.
 *   2. Quelle und Prüfzeit — klein, aber vor allem anderen.
 *   3. Titel.
 *   4. Unternehmen — eigene Zeile, nicht als erstes von vier Merkmalen.
 *   5. Ort, Arbeitsmodell, Vertrag.
 *   6. Gehalt, und darunter die Nettoschätzung.
 *   7. Passung und der eine Satz dazu.
 *   8. Die Hauptaktion, dann die leiseren.
 *
 * Alles Weitere — Aufgaben, Anforderungen, vollständige Analyse —
 * gehört unter diesen Block, nicht davor.
 */

const WORK_MODEL: Record<string, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  on_site: "Vor Ort",
};

const CONTRACT: Record<string, string> = {
  permanent: "Unbefristet",
  fixed_term: "Befristet",
  temp_agency: "Zeitarbeit",
  freelance: "Freiberuflich",
  internship: "Praktikum",
  working_student: "Werkstudium",
  apprenticeship: "Ausbildung",
  minijob: "Minijob",
};

export interface JobKopfDaten {
  job: Job;
  /**
   * Was über den Arbeitgeber bekannt ist — aus der Anreicherung.
   *
   * Alles `null`, solange die Firma nicht angereichert wurde. Das ist
   * der Normalfall, und dann steht hier nichts.
   */
  firma?: { mitarbeiter: string | null; branche: string | null; hauptsitz: string | null } | null;
  quelle: string | null;
  /** Wie nah diese Quelle am Arbeitgeber ist. Fehlt sie, gilt „Sammelstelle". */
  herkunft: Herkunft | null;
  veraltet: boolean;
  /** Der Passungswert und sein Band in Worten. */
  score: number | null;
  bandText: string;
  /** 0 bis 100 — Qualität der ANZEIGE, nicht der Passung. */
  qualitaet?: number | null;
  /** Wie belastbar die Einschätzung ist — dreistufig. */
  sicherheit?: "high" | "medium" | "low" | null;
  /** 0 bis 100 — der gerechnete Wert hinter der Stufe. */
  sicherheitWert?: number | null;
  /**
   * Die Arbeitsbedingungen — was die Stelle BIETET.
   *
   * `null`, wenn zu wenig beurteilbar ist. Getrennt von der
   * Transparenz, die misst, was die Anzeige PREISGIBT.
   */
  bedingungenWert?: number | null;
  /** Die eigene Gehaltsuntergrenze — Massstab für die Farbe. */
  wunschgehalt?: number | null;
  /** Ninas ein Satz dafür und ein Satz dagegen. */
  grund: string | null;
  vorbehalt: string | null;
  /** Die Empfehlung als Auszeichnung, falls es eine gibt. */
  empfehlung: { text: string; ton: "positive" | "caution" | "critical" } | null;
  gesperrt: boolean;
  /** Was vergleichbare Stellen zahlen, wenn diese keine Zahl nennt. */
  vergleich?: import("@/lib/jobs/gehaltsvergleich").Vergleichswert | null;
  /** Die harten Bedingungen — erfüllt, offen oder verletzt. */
  bedingungen: ConstraintResult | null;
}

/**
 * Die Mitarbeiterspanne auf Deutsch.
 *
 * Der Anbieter liefert „10,001+ employees". Das unverändert
 * anzuzeigen wäre in einer deutschen Oberfläche ein Fremdkörper — und
 * „10.001+ Mitarbeitende" liest sich wie eine Zahl, die jemand
 * nachgezählt hat. Es ist eine Spanne, und so steht sie da.
 */
function mitarbeiterText(roh: string): string {
  const t = roh.toLowerCase().replace(/\s*employees?\s*/g, "").trim();
  if (/^10,?001\+?$/.test(t)) return "über 10.000 Mitarbeitende";
  if (/^5,?001-10,?000$/.test(t)) return "5.000–10.000 Mitarbeitende";
  if (/^1,?001-5,?000$/.test(t)) return "1.000–5.000 Mitarbeitende";
  if (/^501-1,?000$/.test(t)) return "500–1.000 Mitarbeitende";
  if (/^201-500$/.test(t)) return "200–500 Mitarbeitende";
  if (/^51-200$/.test(t)) return "50–200 Mitarbeitende";
  if (/^11-50$/.test(t)) return "11–50 Mitarbeitende";
  if (/^2-10$/.test(t)) return "2–10 Mitarbeitende";
  if (/self-employed|^1$/.test(t)) return "Einzelperson";
  return `${roh.replace(/employees?/i, "Mitarbeitende")}`;
}

export function JobKopf({
  daten,
  assistantName,
  /** Die zweiten Aktionen — je Ansicht verschieden. */
  aktionen,
  /** Als `h1` auf der eigenen Seite, als `h2` in der Spalte. */
  titelAls = "h2",
  klebt = false,
}: {
  daten: JobKopfDaten;
  assistantName: string;
  aktionen?: React.ReactNode;
  titelAls?: "h1" | "h2";
  /**
   * Ob der Kopf beim Scrollen oben stehen bleibt.
   *
   * Derzeit nirgends eingeschaltet.
   *
   * In der rechten Spalte war der Gedanke richtig — Titel,
   * Unternehmen, Gehalt und Knöpfe sollen stehen bleiben, während man
   * weiter unten liest. Die Umsetzung war es nicht: Dieser Kopf
   * umfasst Titel, Eckdaten, Gehalt, Knöpfe UND die Passung. Geklebt
   * nimmt er über vierhundert Pixel ein, also die halbe Spalte — und
   * darunter blieb kaum noch etwas zu sehen.
   *
   * Wer es wieder einschaltet, sollte vorher NUR Titel, Unternehmen
   * und die Knöpfe in den klebenden Teil nehmen. Alles andere darf
   * mitrollen.
   */
  klebt?: boolean;
}) {
  const { job, firma } = daten;
  const Titel = titelAls;

  /*
   * Die eine Zahl, die alle drei enthält.
   *
   * Dieselbe Rechnung wie bei der Farbe der Zeile links — nicht eine
   * zweite daneben. Eine eigene Formel hier hiesse, dass dieselbe
   * Stelle in der Liste anders eingestuft wäre als in der Ansicht.
   */
  const gesamtwert = zeilenampel(
    daten.score ?? null,
    daten.qualitaet ?? null,
    daten.sicherheitWert ?? null,
  ).gesamt;

  return (
    <>
      {/*
        Hier stand ein Titelbild über jeder Stelle.

        Es war nie ein Bild DIESER Stelle — es kam aus einer Sammlung
        von Berufsmotiven, ausgewählt anhand des Titels. Neben einer
        Anzeige liest sich ein Bild aber als „so sieht es dort aus",
        und das wissen wir nicht. Im besten Fall war es Dekoration,
        im schlechteren eine Andeutung über einen Arbeitsplatz, den
        niemand von uns gesehen hat.

        Der Platz gehört den Angaben, die belegt sind: Titel,
        Unternehmen, Gehalt mit Herkunft, Bedingungen.
      */}

      {/*
        `bg-page` ist beim Kleben Pflicht, nicht Geschmack: Ohne
        eigene Fläche scheint der Text durch, der darunter
        hindurchrollt. `pb-5` gibt der Unterkante Luft, damit die
        Trennung zum Mitlaufenden zu sehen ist.
      */}
      <header
        className={
          "grid gap-4" +
          (klebt ? " sticky top-0 z-20 bg-page pb-5" : "")
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="outline">Quelle: {daten.quelle ?? "unbekannt"}</Badge>
          {/* Titelschrift wie Ninas Name — dieselbe Begründung: Das
              Datum steht in keiner Spalte, also braucht es keine
              gleichen Zeichenbreiten. */}
          <span className="font-titel text-[11px] text-ink-3">
            geprüft {new Intl.DateTimeFormat("de-DE").format(job.fetchedAt)}
          </span>
          {daten.veraltet && <Badge tone="caution">womöglich veraltet</Badge>}
          {daten.gesperrt && <Badge tone="critical">Ausschlusskriterium</Badge>}
          {job.isDemo && <Badge tone="caution">Demo-Datensatz</Badge>}
        </div>

        {/* 34–44px laut Vorgabe für den Jobtitel im Detail. */}
        {/* Instrument Sans wie in der Liste — ein Stellentitel sieht
            überall gleich aus, ob in der Zeile oder in der Ansicht. */}
        {/*
          Titel links, Passung oben rechts.
          
          Sie stand am Ende des Kopfes, hinter Gehalt und Knöpfen. Dort
          fand sie niemand — die Zahl, nach der man eine Liste
          durchgeht, gehört auf Augenhöhe mit dem Titel.
          
          Die Farbe kommt aus `bandAusScore`, derselben Einstufung wie
          in der Liste links. Eine eigene Schwelle hier hiesse, dass
          dieselbe Stelle an zwei Orten verschieden eingefärbt wäre.
        */}
        <div className="flex items-start justify-between gap-6">
          <Titel className="font-titel text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] lg:text-[38px]">
            {job.title}
          </Titel>

          {daten.score !== null && (
            <span className="shrink-0 text-right">
              <span
                className={
                  "block font-mono text-[2.25rem] font-semibold leading-none tabular " +
                  AMPELTON[ampelstufe(daten.score)].text
                }
              >
                {daten.score}
              </span>
              <span className="mt-1 block text-xs text-ink-3">Passung</span>
            </span>
          )}
        </div>

        {/*
         * Unternehmen und Eckdaten getrennt.
         *
         * Vorher standen sie in einer Zeile mit Mittelpunkten
         * dazwischen: „Ane · Hamburg · Vor Ort · Werkstudium". Der Name
         * des Arbeitgebers ging darin unter — er sah aus wie das erste
         * von vier gleichrangigen Merkmalen, ist aber das, wonach
         * jemand als Nächstes fragt, wenn er den Titel gelesen hat.
         */}
        <p className="text-[17px] font-medium leading-snug text-ink">{job.companyName}</p>
        {/*
         * Was wir über den Arbeitgeber wissen.
         *
         * ── Warum das hier steht ──────────────────────────────
         *
         * „Disponent bei der Müller GmbH" sagt über den Arbeitgeber
         * nichts. „Ein Betrieb mit 45 Mitarbeitern im Anlagenbau" ist
         * für eine Entscheidung ein anderer Satz — und dieselbe Zahl
         * fliesst in die Beschäftigungssicherheit ein.
         *
         * Steht nichts da, steht hier nichts. Kein Platzhalter, keine
         * Vermutung: Von 135.956 Firmen sind bisher 186 angereichert,
         * und ein „unbekannt" bei 99,9 % wäre nur Rauschen.
         */}
        {firma && (firma.mitarbeiter || firma.branche || firma.hauptsitz) && (
          <p className="mt-0.5 text-sm text-ink-3">
            {[
              firma.mitarbeiter ? mitarbeiterText(firma.mitarbeiter) : null,
              firma.branche,
              firma.hauptsitz,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        <p className="text-sm text-ink-2">
          {job.location} · {WORK_MODEL[job.workModel] ?? job.workModel}
          {job.contractType ? ` · ${CONTRACT[job.contractType] ?? job.contractType}` : ""}
        </p>

        {/*
         * Netto direkt unter dem Brutto.
         *
         * Nicht auf einer eigenen Rechnerseite: die Frage „was bleibt
         * mir davon" stellt sich genau hier, beim Lesen der Zahl, und
         * nicht nach einem Seitenwechsel.
         */}
        <GehaltBlock
          job={job}
          vergleich={daten.vergleich ?? null}
          /*
           * Der Anzeigentext wird EINMAL geprüft, beim Rendern der
           * Seite. `gehaltsbefund` ist rein und ohne Netzzugriff — es
           * kostet nichts und verhindert den Fehler, für den es
           * gebaut wurde: dass die erste gefundene Zahl als „das
           * Gehalt" durchgeht, obwohl die Anzeige zwei nennt.
           */
          befund={job.description ? gehaltsbefund(job.description) : null}
          /* Der Massstab für die Farbe: die eigene Untergrenze. */
          wunschgehalt={daten.bedingungen ? (daten.wunschgehalt ?? null) : null}
        >
          <NettoSchaetzung job={job} />
        </GehaltBlock>

        {/*
         * Eine Hauptaktion, dann die leiseren.
         *
         * „Bewerbung vorbereiten" steht vorn, weil es die Handlung ist,
         * um die es geht. Alles andere — Original ansehen, die eigenen
         * Aktionen der Detailseite — ist ein Zwischenschritt und sieht
         * auch so aus.
         *
         * ── Warum sie ganz oben steht ─────────────────────────
         *
         * Sie war schon unter dem Gehalt und einmal ganz unten nach
         * der Bedingungsprüfung. Beide Male stand etwas dazwischen,
         * das gelesen werden wollte, bevor man handeln durfte.
         *
         * Jetzt hinter Titel, Unternehmen, Eckdaten und Gehalt — also
         * hinter den vier Angaben, die entscheiden, ob einen die
         * Stelle überhaupt angeht. Das Gehalt gehört dazu: Ohne die
         * Zahl ist „Bewerbung vorbereiten" eine Handlung ins Blaue.
         *
         * Alles Weitere — was der Wechsel bringt, warum Nina sie
         * zeigt, die Passung — steht darunter und begründet. Wer
         * begründen will, liest weiter; wer entschieden hat, klickt.
         */}
        <div className="flex flex-wrap gap-2.5 pt-1">
          <Button asChild variant="primary" size="sm">
            <Link href={`/app/jobs/${job.id}/apply`}>Bewerbung vorbereiten</Link>
          </Button>

          {job.originalUrl && (
            /* Der Knopf nennt, wohin er führt: „Weiter zu Arbeitnow"
               statt „Original ansehen". Wer „Original" liest, erwartet
               die Quelle und landet bei einem weiteren Vermittler. */
            <Button asChild variant="ghost" size="sm">
              <a href={job.originalUrl} target="_blank" rel="noopener noreferrer">
                {linkTextMitZiel(daten.herkunft ?? "aggregator", daten.quelle, job.originalUrl)}
                <ExternalLink className="size-3.5" strokeWidth={1.8} />
              </a>
            </Button>
          )}

          {aktionen}
        </div>



        {/*
         * Hier stand „Was der Wechsel bringt", danach kurz ein Kasten
         * „Frag Nina zu dieser Stelle". Beides ist weg.
         *
         * Nina hat ab jetzt genau einen Einstieg: die schwebende
         * Blase unten rechts. Eine zweite Eingabe mitten in der
         * Stellenanzeige wäre ein zweiter Eingang in dieselbe Sitzung
         * — und die Person müsste raten, welcher der richtige ist.
         *
         * `Wechselrechnung` bleibt als Baustein bestehen; sie gehört
         * dorthin, wo jemand ausdrücklich rechnen will.
         */}

        {/*
         * Hier stand „Warum Nina sie zeigt" mit zwei Zeilen Grund und
         * Vorbehalt darunter.
         *
         * In der Praxis lautete der Text bei fast jeder Stelle „Sieht
         * interessant aus — für eine belastbare Einschätzung kennt
         * Nina dich noch nicht gut genug", und der Vorbehalt nannte
         * fehlende Fähigkeiten. Beides stimmt und beides sagt über
         * DIESE Stelle nichts: Es sagt etwas über den Stand des
         * Profils, und das gehört nicht in den Kopf jeder Anzeige.
         *
         * Die Angaben `grund` und `vorbehalt` bleiben in den Daten;
         * die Passungsansicht nutzt sie, wo sie im Zusammenhang
         * stehen.
         */}

        {/*
          Die Passung am Ende des Kopfes.
          
          Sie stand einmal zwischen Gehalt und Knöpfen und schob damit
          die Handlung nach unten. Jetzt steht sie hinter allem, was
          sie begründet — Gehalt und die Angaben der Anzeige, „warum Nina sie
          zeigt" — und leitet über zu dem, was darunter
          aufgeschlüsselt wird: formale Anforderungen, Fähigkeiten,
          Arbeitsalltag, Sicherheit der Einschätzung.
        */}
        {/*
          Die Passung steht nur da, wenn es eine gibt.
          
          Ohne berechneten Wert erschienen „–" und daneben „Passung
          noch offen". Zwei Zeichen und drei Wörter, die zusammen
          sagen: Wir wissen nichts. Das ist wahr und es steht in
          jedem Stellenkopf, bei jeder Anzeige, unverändert — also
          eine Aussage über uns, nicht über die Stelle.
          
          Solange die Grundlage fehlt, bleibt die Zeile leer. Woran es
          liegt, sagt die Passungsansicht, wo es im Zusammenhang steht.
        */}
        {/*
          Unten im Kopf: die Qualität der Anzeige als Leiste.
          
          Die Passung steht oben rechts und beantwortet „passt das zu
          MIR". Diese Leiste beantwortet etwas anderes: wie vollständig
          und nachvollziehbar die ANZEIGE ist. Zwei Fragen, zwei Orte —
          sie in eine Zahl zu mischen ergäbe einen Mittelwert, der
          keine davon beantwortet.
          
          Als Leiste statt als Zahl, weil hier der Rang zählt und nicht
          der Wert: „vollständig" gegenüber „lückenhaft" liest sich in
          einer Länge schneller als in „68 von 100".
        */}
        {/*
          Drei Leisten nebeneinander — drei verschiedene Fragen.
          
          Passung:    Passt die Stelle zu DIESER Person?
          Qualität:   Ist die ANZEIGE vollständig und nachvollziehbar?
          Sicherheit: Wie belastbar ist unsere Einschätzung überhaupt?
          
          Sie standen an drei Orten in drei Formen: eine grosse Zahl im
          Kopf, eine Leiste darunter, drei Punkte weiter unten. Wer sie
          vergleichen wollte, musste scrollen — und verglich dann eine
          Zahl mit einer Punktreihe.
          
          Nebeneinander in derselben Form beantwortet die Anordnung die
          Frage, die man tatsächlich hat: Woran hakt es?
          
          Die Sicherheit behält ihre eigene Farbskala. Sie sagt nichts
          über die Stelle, sondern über unseren Kenntnisstand — sie rot
          zu färben hiesse „hier stimmt etwas nicht", und das wäre die
          falsche Aussage.
        */}
        {/*
          Untereinander, nicht nebeneinander.
          
          In drei Spalten war jede Leiste ein Drittel breit — und drei
          kurze Balken verschiedener Länge lassen sich schlechter
          vergleichen als drei lange. Untereinander haben alle dieselbe
          Grundlänge, und der Unterschied liegt allein in der Füllung.
          Genau das soll man sehen.
        */}
        {/*
          Eine Leiste statt dreier.
          
          Hier standen Matching, Qualität der Anzeige und Sicherheit
          untereinander. Drei Balken sind drei Zahlen, und drei Zahlen
          über einer Anzeige sind eine Kennzahlentafel — man vergleicht
          sie miteinander, statt die Stelle zu lesen.
          
          Übrig bleibt die eine, die alle drei enthält:
          0,5 Matching + 0,3 Qualität + 0,2 Sicherheit, grün erst ab 75
          und nur, wenn kein Einzelwert unter 50 liegt.
          
          Die Einzelwerte sind nicht verschwunden — die Nina-Analyse
          darunter nennt jeden mit seiner Zahl und einem Satz dazu.
          Dort stehen sie im Zusammenhang statt als Balkenreihe.
        */}
        {/*
          Der Fit Score und die drei Werte, aus denen er entsteht.
          
          Oben die eine Zahl, die zählt — sie bestimmt auch die Farbe
          der Zeile in der Liste links, damit dieselbe Stelle dort und
          hier gleich eingestuft ist.
          
          Darunter ihre Bestandteile, damit die Zahl nicht vom Himmel
          fällt: 0,5 Matching + 0,3 Qualität + 0,2 Sicherheit, grün
          erst ab 75 und nur, wenn kein Einzelwert unter 50 liegt.
        */}
        <div className="grid gap-2.5 pt-3">
          <Leiste
            titel="Fit Score"
            wert={gesamtwert}
            fuellung={gesamtwert !== null ? AMPELTON[ampelstufe(gesamtwert)].fuellung : null}
            leer="noch nicht berechenbar"
          />

          <div className="grid gap-2 border-t border-line-2 pt-2.5">
            <Leiste
              titel="Matching"
              wert={daten.score ?? null}
              fuellung={
                daten.score !== null && daten.score !== undefined
                  ? AMPELTON[ampelstufe(daten.score)].fuellung
                  : null
              }
              leer="noch nicht berechenbar"
            />
            <Leiste
              titel="Transparenz der Anzeige"
              wert={daten.qualitaet ?? null}
              fuellung={
                daten.qualitaet !== null && daten.qualitaet !== undefined
                  ? AMPELTON[ampelstufe(daten.qualitaet)].fuellung
                  : null
              }
              leer="nicht beurteilbar"
            />
            {/*
              „Datenlage", nicht „Sicherheit".
              
              `computeConfidence` sagt in seinem eigenen Kopfkommentar,
              was es misst: „wie sicher können wir uns dabei überhaupt
              sein". Also die Belastbarkeit UNSERER Einschätzung — eine
              Aussage über unseren Kenntnisstand, nicht über den
              Arbeitsplatz.
              
              Unter der Überschrift „Sicherheit" las das jeder als
              Arbeitsplatzsicherheit. Das ist die Verwechslung, die
              Abschnitt 6 ausdrücklich untersagt: Vertragsstabilität
              und Datenverlässlichkeit sind verschiedene Dinge, und
              eines darf das andere nicht stillschweigend ersetzen.
            */}
            {/*
              Die Arbeitsbedingungen als eigene Grösse.
              
              Sie stecken in `computeJobQuality` und flossen bisher nur
              in den Gesamtwert ein — sichtbar war ausschliesslich die
              Transparenz der Anzeige. Damit fehlte von den drei
              Hauptansichten aus Abschnitt 9 genau die, die etwas über
              die STELLE sagt.
              
              `null`, wenn zu wenig beurteilbar ist. Das ist häufig:
              Vier der sieben Dimensionen stammen aus
              Mitarbeiterstimmen, und die haben wir für fast keine
              Stelle. Eine Zahl daraus zu erzwingen hiesse, aus dem
              Nichts ein Urteil zu machen.
            */}
            <Leiste
              titel="Arbeitsbedingungen"
              wert={daten.bedingungenWert ?? null}
              fuellung={
                daten.bedingungenWert !== null && daten.bedingungenWert !== undefined
                  ? AMPELTON[ampelstufe(daten.bedingungenWert)].fuellung
                  : null
              }
              leer="nicht beurteilbar"
            />
            <Leiste
              titel="Datenlage"
              wert={daten.sicherheitWert ?? null}
              fuellung={
                daten.sicherheitWert !== null && daten.sicherheitWert !== undefined
                  ? AMPELTON[ampelstufe(daten.sicherheitWert)].fuellung
                  : null
              }
              leer="unbekannt"
            />
          </div>
        </div>

        {/*
          Direkt unter den Leisten: was von deinen Bedingungen gedeckt
          ist.
          
          Die Leisten sagen, WIE GUT es passt. Diese Reihe sagt, WAS
          davon belegt ist — Ort, Arbeitsmodell, Gehaltsuntergrenze,
          Vertragsart, was immer festgelegt wurde.
          
          Aus `constraints.checks`, derselben Prüfung, die weiter unten
          in Sätzen steht. Sie rechnet hier nichts nach: Eine zweite
          Ableitung wäre eine zweite Wahrheit.
        */}
        {daten.bedingungen && (
          <div className="pt-3">
            <Bedingungsbadges ergebnis={daten.bedingungen} />
          </div>
        )}

        {daten.empfehlung && (
          <div className="pt-3">
            <Badge tone={daten.empfehlung.ton}>{daten.empfehlung.text}</Badge>
          </div>
        )}
      </header>

      {/*
       * Hier stand ein Absatz zur Herkunft der Anzeige.
       *
       * Er erklärte, dass etwa Arbeitnow die Anzeige seinerseits von
       * woanders hat und wir die ursprüngliche Quelle nicht kennen.
       * Das stimmt — nur steht es unter JEDER Stelle im selben
       * Wortlaut und wird damit zur Tapete.
       *
       * Die Auskunft ist nicht verloren: Die Plakette „Quelle: …"
       * oben im Kopf nennt weiterhin, woher die Anzeige kommt, und
       * das Prüfdatum steht daneben. Wer weitergeht, sieht ausserdem
       * am Ziel, bei wem er landet.
       */}

      {/*
       * Hier stand „Deine Bedingungen an dieser Stelle" als Kasten mit
       * einer Zeile je Bedingung, Symbol, Satz und den Rohwerten
       * darunter („Anzeige: on_site · Deine Vorgabe: on_site, hybrid,
       * remote").
       *
       * Dieselbe Auskunft steht jetzt oben als Plakettenreihe unter
       * den Leisten — kürzer, an der Stelle, an der man sie sucht, und
       * aus derselben Prüfung. Zweimal dasselbe in zwei Längen ist
       * nicht gründlicher, sondern doppelt.
       *
       * `Bedingungspruefung` bleibt als Baustein bestehen; die
       * Einzelseite einer Stelle hat Platz für die lange Form.
       */}

      {/*
        Die Aktionen — nach der Prüfung, nicht davor.
        
        Sie standen direkt unter dem Gehalt, also zwischen der Zahl und
        allem, was die Zahl erklärt. Hier unten kommen sie nach den
        Bedingungen und der Herkunftsangabe: Wer jetzt handelt, hat
        gelesen, worauf er sich einlässt.
        
        Der Verweis zur Quelle ist mit weggefallen — der Satz darüber
        nennt sie ohnehin, und `/app/jobs/[id]` reicht seine eigenen
        Aktionen über `aktionen` herein.
      */}
    </>
  );
}

function kleinAnfang(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}


/**
 * Eine beschriftete Leiste.
 *
 * `wert` ist die Breite in Prozent, `anzeigeText` überschreibt die
 * Beschriftung rechts — bei der Sicherheit steht dort „mittel" und
 * nicht „60", weil die Zahl nur die Breite ist und keine Aussage.
 */
function Leiste({
  titel,
  wert,
  fuellung,
  anzeigeText,
  leer,
}: {
  titel: string;
  wert: number | null;
  fuellung: string | null;
  anzeigeText?: string;
  leer: string;
}) {
  /*
   * Die Zahl trägt dieselbe Farbe wie die Leiste.
   *
   * Sie stand in Grau. Wer die Leisten überfliegt, liest die Zahlen —
   * und musste die Farbe daneben getrennt aufnehmen. Beide in einer
   * Farbe machen aus zwei Zeichen eines.
   *
   * Die Farbe kommt aus dem Wert, nicht aus der Füllklasse: Ein
   * Hintergrund lässt sich nicht als Schriftfarbe wiederverwenden,
   * und aus `bg-positive` per Zeichenersetzung `text-positive` zu
   * bauen wäre ein Trick, der beim ersten Sonderfall bricht.
   */
  const ton = wert !== null && fuellung ? AMPELTON[ampelstufe(wert)].text : "text-ink-3";
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="abschnitts-titel text-ink-3">{titel}</span>
        <span className={"font-mono text-xs tabular " + ton}>
          {wert === null || !fuellung ? leer : (anzeigeText ?? `${wert} %`)}
        </span>
      </div>
      <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-inset">
        {wert !== null && fuellung && (
          <span
            className={"block h-full rounded-full " + fuellung}
            style={{ width: `${Math.max(4, Math.min(100, wert))}%` }}
          />
        )}
      </span>
    </div>
  );
}
