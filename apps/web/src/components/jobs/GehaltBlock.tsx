import type { Job } from "@paycheck/domain";
import { vorgabenampel } from "@/lib/jobs/vorgabenampel";
import { gehaltsanzeige } from "@/lib/jobs/gehaltsanzeige";
import { alsSpanne, type Vergleichswert } from "@/lib/jobs/gehaltsvergleich";

/**
 * Das Gehalt — die Zahl, wegen der die meisten überhaupt hinsehen.
 *
 * Vorher stand hier eine Zeile im Fliesstext, gleich gross wie Ort und
 * Vertragsart daneben. Für die Frage, die als Erstes gestellt wird, war
 * das zu leise.
 *
 * Drei Zustände, und die Unterscheidung ist der eigentliche Inhalt:
 *
 *   **Vom Arbeitgeber angegeben** → grün und gross. Grün heisst hier
 *   nicht „gutes Gehalt" — über die Höhe sagen wir nichts. Es heisst:
 *   diese Zahl steht in der Anzeige, jemand hat sich festgelegt, du
 *   musst nicht danach fragen.
 *
 *   **Geschätzt** → neutral. Eine Schätzung in derselben Farbe wie eine
 *   Zusage wäre eine Verwechslung, die Geld kostet.
 *
 *   **Nicht angegeben** → ruhig und ohne Kommentar. Hier stand
 *   „Gehalt nicht angegeben — das ist keine schlechte Angabe, sondern
 *   gar keine." Der Satz stimmt und ist trotzdem falsch am Platz: er
 *   ist eine Pointe auf Kosten des Arbeitgebers, und wer gerade eine
 *   Stelle sucht, braucht keine Pointe, sondern eine Auskunft.
 *
 * Die Farbe ist nie die einzige Aussage. Über jedem Zustand steht ein
 * Wort, das ihn benennt — wer Grün nicht als Grün sieht, liest
 * „angegeben".
 */

export function GehaltBlock({
  job,
  vergleich,
  befund,
  wunschgehalt,
  /** Platz für die Nettoschätzung. Wird später vom Rechner gefüllt. */
  children,
}: {
  job: Pick<Job, "salary">;
  /**
   * Was die Anzeige sonst noch über Gehalt sagt.
   *
   * Serverseitig geprüft und hereingereicht, nicht hier gelesen: Der
   * Anzeigentext liegt beim Seitenaufbau vor, und `gehaltsbefund` ist
   * eine reine Funktion — sie im Browser laufen zu lassen hiesse, den
   * ganzen Text mitzuschicken, um dasselbe Ergebnis zu bekommen.
   */
  befund?: { hinweise: string[]; angaben: { min: number | null; max: number | null; zeitraum: string | null; art: string; beleg: string }[] } | null;
  /** Was vergleichbare Stellen zahlen — wenn diese keine Zahl nennt. */
  vergleich?: Vergleichswert | null;
  /** Die eigene Untergrenze — Massstab für die Farbe. */
  wunschgehalt?: number | null;
  children?: React.ReactNode;
}) {
  const { salary } = job;

  /*
   * Der Vergleich gegen das Wunschgehalt.
   *
   * Verglichen wird die UNTERGRENZE der Anzeige, nicht die Mitte oder
   * das Maximum: „50.000 bis 70.000" heisst, dass 50.000 möglich ist.
   * Die Obergrenze zu nehmen färbte eine Spanne grün, deren unteres
   * Ende weit unter der Vorgabe liegt.
   */
  const gehaltsampel = vorgabenampel(salary.min ?? salary.max ?? null, wunschgehalt ?? null, "hoeher_besser");

  const geld = (wert: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: salary.currency,
      maximumFractionDigits: 0,
    }).format(wert);

  const zeitraum =
    salary.period === "year"
      ? "pro Jahr"
      : salary.period === "month"
        ? "pro Monat"
        : salary.period === "hour"
          ? "pro Stunde"
          : "";

  const anzeige = gehaltsanzeige(salary);

  if (!anzeige) {
    /*
     * Kein Gehalt in der Anzeige — aber deshalb nicht nichts.
     *
     * Was vergleichbare Stellen zahlen, ist eine echte Auskunft. Sie ist
     * nur eine andere: nicht „diese Stelle zahlt", sondern „so liegen
     * ähnliche Stellen". Der Unterschied steht deshalb in der
     * Überschrift, nicht in einer Fussnote.
     *
     * Ohne tragfähige Vergleichsbasis bleibt es beim schlichten „nicht
     * angegeben". Eine Spanne aus drei Anzeigen wäre eine Zahl mit
     * Nachkommastellen und ohne Bedeutung.
     */
    return (
      <div className="grid gap-1.5">
        <h3 className="abschnitts-titel text-ink-3">Gehalt</h3>

      {/*
        Widersprüche stehen bei der Zahl, nicht hinter einer Frage.
        
        Eine Anzeige, die an einer Stelle 7.000–10.000 im Monat nennt
        und an anderer 3.000–7.000 „je nach Qualifikation", gibt keine
        verlässliche Zahl her. Das gehört neben die Zahl — nicht in
        eine Ansicht, die man erst öffnen muss, und schon gar nicht in
        eine Frage an Monday, die man erst stellen muss.
      */}
      {befund && befund.hinweise.length > 0 && (
        <ul className="grid gap-1 rounded-(--radius-md) border border-caution/40 bg-caution-soft px-3 py-2">
          {befund.hinweise.map((h) => (
            <li key={h} className="text-sm leading-relaxed text-ink-2">
              {h}
            </li>
          ))}
        </ul>
      )}

      {/*
        Bei mehreren Angaben stehen sie nebeneinander.
        
        Keine wird zur Hauptangabe erklärt. Welche gilt, weiss die
        Anzeige selbst nicht — und das ist die Auskunft.
      */}
      {befund && befund.angaben.length > 1 && (
        <ul className="grid gap-1.5">
          {befund.angaben.map((a, i) => (
            <li key={i} className="text-sm leading-relaxed text-ink-2">
              <span className="font-mono tabular">
                {a.min?.toLocaleString("de-DE")}
                {a.max !== null && a.max !== a.min ? `–${a.max.toLocaleString("de-DE")}` : ""} €
              </span>{" "}
              <span className="text-ink-3">
                {a.zeitraum === "month"
                  ? "pro Monat"
                  : a.zeitraum === "hour"
                    ? "pro Stunde"
                    : a.zeitraum === "year"
                      ? "pro Jahr"
                      : "Zeitraum nicht genannt"}
                {a.art === "variabel"
                  ? " · variabel"
                  : a.art === "bedingt"
                    ? " · an Bedingungen geknüpft"
                    : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
        <p className="text-[17px] text-ink-2">Nicht angegeben</p>

        {/*
          Ohne Vergleichsbasis steht der Grund da, nicht nichts.
          
          Rund 29 % der Stellen liegen in Berufsgruppen, für die uns
          weniger als fünf unabhängige Gehaltsangaben vorliegen. Eine
          Spanne aus zwei Anzeigen wäre eine Zahl mit Nachkommastellen
          und ohne Bedeutung — ein leerer Block sieht dagegen aus wie
          ein Fehler.
          
          Der Satz sagt beides: dass wir nichts haben, und dass es an
          der Datenmenge liegt und nicht an der Stelle.
        */}
        {!vergleich && (
          <p className="mt-1 max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
            Für diese Art von Stelle liegen uns noch zu wenige Gehaltsangaben vor, um eine
            Grössenordnung zu nennen. Sobald mehr Anzeigen dieser Berufsgruppe eine Zahl nennen,
            steht sie hier — geschätzt wird nichts.
          </p>
        )}

        {vergleich && (
          <div className="mt-1 grid gap-1 rounded-(--radius-md) bg-inset px-4 py-3">
            <p className="abschnitts-titel text-ink-3">
              Vergleichbare Stellen
            </p>
            <p className="font-mono text-lg tabular text-ink">{alsSpanne(vergleich)}</p>
            {/*
             * Woher die Zahl kommt, steht dabei.
             *
             * Es gibt jetzt drei Quellen, und sie sind verschieden viel
             * wert: die amtliche Beschäftigungsstatistik, die
             * ausgewerteten Gehaltsangaben der Jobbörse zum selben
             * amtlichen Beruf, und der eigene Bestand nach grober
             * Berufsgruppe. Alle drei als „Vergleichbare Stellen" zu
             * zeigen hiesse, den Unterschied zu verstecken.
             */}
            <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
              {vergleich.quelle === "entgeltatlas" ? (
                <>
                  Mittlere Hälfte laut Entgeltatlas der Bundesagentur für Arbeit
                  {vergleich.beruf ? <> für „{vergleich.beruf}"</> : null}. Amtliche
                  Beschäftigungsstatistik, keine Auswertung von Anzeigen — und kein Gehalt dieser
                  Stelle, sondern eine Grössenordnung für das Gespräch.
                </>
              ) : vergleich.quelle === "bundesagentur" ? (
                <>
                  Mittlere Hälfte aus {vergleich.anzahl} Gehaltsangaben in Anzeigen der
                  Bundesagentur für Arbeit
                  {vergleich.beruf ? <> für „{vergleich.beruf}"</> : null}, je Arbeitgeber höchstens
                  zwei. Das ist kein Gehalt dieser Stelle, sondern eine Grössenordnung für das
                  Gespräch.
                </>
              ) : (
                <>
                  Mittlere Hälfte aus {vergleich.anzahl} vergleichbaren Stellen mit Gehaltsangabe,
                  je Arbeitgeber höchstens zwei. Das ist kein Gehalt dieser Stelle, sondern eine
                  Grössenordnung für das Gespräch.
                </>
              )}
            </p>
          </div>
        )}

        {children}
      </div>
    );
  }

  const von = salary.min ?? salary.max!;
  const bis = salary.max ?? salary.min!;
  const spanne = von !== bis;

  return (
    <div className="grid gap-1.5">
      {/*
       * Die Herkunft steht in der Überschrift, nicht als Fussnote.
       *
       * Vorher stand hier fest „vom Arbeitgeber angegeben" — was für
       * die eine Stelle stimmte, die ein Gehaltsfeld mitbrachte. Die
       * siebzig aus dem Text gelesenen Beträge wurden gar nicht erst
       * angezeigt, sonst hätte die Zeile dort schlicht gelogen.
       */}
      {/*
       * Nur „Gehalt". Die Herkunft stand hier und ist raus.
       *
       * „GEHALT · IN DER ANZEIGE GENANNT" erklärte eine Unterscheidung,
       * die für die Zahl darunter nichts ändert — und nahm der
       * Überschrift die Ruhe. Die Herkunft ist damit nicht verschwunden:
       * Sie steckt weiterhin in der grünen Fläche, die es nur bei einer
       * Arbeitgeberangabe gibt, und in der Fussnote darunter, wo eine
       * Schätzung als Schätzung benannt wird.
       */}
      <h3 className="abschnitts-titel text-ink-3">Gehalt</h3>

      {/*
       * Die weiche grüne Fläche nur bei der Arbeitgeberangabe.
       *
       * Sie hebt die Zahl heraus, ohne sie in ein Signal zu verwandeln —
       * über die HÖHE urteilen wir hier nicht. Grün heisst: Jemand hat
       * sich festgelegt, du musst nicht danach fragen.
       *
       * Eine gelesene oder geschätzte Zahl bekommt sie nicht. Grün
       * liest sich im Produkt als „bestätigt", und das wäre bei einer
       * Portalschätzung eine Behauptung über den Arbeitgeber, die
       * niemand gemacht hat.
       */}
      <p
        className={
          "inline-flex w-fit items-baseline gap-2 rounded-(--radius-pill) px-4 py-2 " +
          /*
           * Die Farbe misst gegen DEINE Vorgabe, nicht gegen eine
           * Skala.
           *
           * Vorher war der Kasten immer grün — er markierte, dass eine
           * Angabe da ist. Grün heisst für jeden Menschen aber „gut",
           * und ein Gehalt weit unter dem eigenen Wunsch grün zu
           * hinterlegen ist eine Aussage, die niemand gemacht hat.
           *
           * Jetzt: grün, wenn die Vorgabe erreicht ist; gelb bei
           * knapper Verfehlung; rot bei deutlicher. Ohne hinterlegtes
           * Wunschgehalt bleibt es neutral — eine Zahl einzufärben,
           * für die niemand ein Ziel genannt hat, wäre ein Urteil,
           * das wir uns anmassen.
           */
          (gehaltsampel === "gruen"
            ? "border border-positive/60 bg-positive-soft"
            : gehaltsampel === "gelb"
              ? "border border-caution/60 bg-caution-soft"
              : gehaltsampel === "rot"
                ? "border border-critical/50 bg-critical-soft"
                : "border border-line-2 bg-inset")
        }
      >
        {/* Dunkle Schrift im grünen Feld — dieselbe Regel wie in der
            Liste: Der Kasten markiert die Angabe, er bewertet sie
            nicht. */}
        <span className="font-mono text-xl font-semibold tabular text-ink">
          {anzeige.betrag}
        </span>
        <span className="text-sm text-ink-2">{anzeige.zeitraum}</span>
        {/* Ohne diesen Zusatz hielte man eine hochgerechnete Zahl für
            die Angabe des Arbeitgebers. Die Anzeige nannte etwas
            anderes, und das gehört daneben. */}
        {anzeige.umgerechnet && (
          <span className="text-2xs text-ink-3">umgerechnet aus {anzeige.urspruenglich}</span>
        )}
      </p>

      {/*
       * Bei einer Zahl ohne Zusage ein Satz dazu.
       *
       * Die Überschrift nennt die Herkunft — aber wer nur auf die Zahl
       * schaut, liest sie nicht. Ein Satz DARUNTER trifft den Blick, der
       * gerade auf dem Betrag lag.
       *
       * Nur wo es nötig ist: Wo der Arbeitgeber selbst spricht, steht
       * hier nichts. Ein Hinweis unter jeder Zahl wäre nach der dritten
       * Stelle unsichtbar.
       */}
      {!anzeige.zugesagt && (
        <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
          {anzeige.herkunft === "schaetzung"
            ? "Diese Zahl hat ein Stellenportal geschätzt — der Arbeitgeber hat sie nicht genannt. Nimm sie als Grössenordnung, nicht als Grundlage für eine Verhandlung."
            : "Diese Zahl kam über ein Stellenportal zu uns. Wer sie ursprünglich genannt hat, wissen wir nicht."}
        </p>
      )}

      {children}
    </div>
  );
}
