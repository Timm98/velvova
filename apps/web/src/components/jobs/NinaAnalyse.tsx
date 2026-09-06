import { ArrowRight } from "lucide-react";
import { rangbegruendung, type Werte, type Zukunftsdaten } from "@/lib/jobs/rangbegruendung";
import type { WorkspaceDaten } from "@/app/app/jobs/nina/daten";

/**
 * Ninas Lesart der Stelle — direkt unter dem Kopf.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das die erste Auskunft der Seite ist
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Stellenanzeige ist ein Text, den ein Arbeitgeber über sich
 * schreibt. Was daraus für eine bestimmte Person folgt, steht nicht
 * darin — und genau das ist die Frage, mit der jemand die Seite
 * öffnet.
 *
 * Deshalb steht hier zuerst die Deutung und darunter der Text. Nicht
 * umgekehrt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum drei Listen und keine Fliesstextzusammenfassung
 * ══════════════════════════════════════════════════════════════
 *
 * „Dafür", „darauf achten", „noch klären" sind drei verschiedene
 * Sachverhalte, und ein Absatz macht daraus einen. Wer schnell liest,
 * nimmt aus einem Absatz das Erste mit — meistens das Positive, weil
 * es vorne steht.
 *
 * Die dritte Liste ist die wichtigste und fehlt in jeder Jobbörse:
 * Was die Anzeige NICHT sagt. Eine fehlende Angabe ist keine gute und
 * keine schlechte Nachricht, sondern eine offene Frage — und sie
 * verschwindet, wenn man nur dafür und dagegen kennt.
 */
export function NinaAnalyse({
  daten,
  assistantName,
  vollstaendigHref,
  werte,
  zukunft,
}: {
  daten: WorkspaceDaten;
  assistantName: string;
  /** Wohin die ausführliche Analyse führt. */
  vollstaendigHref?: string;
  /** Die drei Zahlen der Leisten darüber — sie werden hier erklärt. */
  /* Die vier Grössen, die die Analyse erklärt. Der Typ kommt aus
     `rangbegruendung`, damit er nicht an zwei Stellen gepflegt wird. */
  werte: Werte;
  /** Wie es dem Beruf geht — der Ersatz, wenn keine Passung vorliegt. */
  zukunft?: Zukunftsdaten | null;
}) {
  /*
   * Ohne Passung spricht Nina über den Beruf.
   *
   * Die Alternative wäre dreimal „kennt dich noch nicht gut genug" —
   * wahr und für jemanden, der gerade eine Anzeige liest, nutzlos.
   * Über die Berufsgruppe lässt sich auch ohne Profil etwas sagen.
   */
  const begruendung = rangbegruendung(werte, zukunft ?? null);

  return (
    <section aria-labelledby={`analyse-${daten.jobId}`} className="grid gap-4">
      <h3
        id={`analyse-${daten.jobId}`}
        className="abschnitts-titel text-ink-3"
      >
        {assistantName} — Analyse
      </h3>

      {/*
        Die Analyse erklärt die Leisten darüber.
        
        Vorher stand hier ein Satz über den Stand des Profils —
        „Einiges passt zu dem, was ich bisher über dich weiss" — und
        darunter drei Listen, von denen meist zwei „Nichts gefunden"
        meldeten. Über der Analyse stehen drei Zahlen; wer sie sieht
        und darunter einen Text liest, erwartet, dass der Text die
        Zahlen erklärt.
        
        Jetzt: ein Satz zur Gesamteinstufung, der den schwächsten der
        drei Werte beim Namen nennt, und je ein Satz zu jeder Leiste.
      */}
      {/*
        Der Beruf zuerst.
        
        Er gilt auch ohne Profil und beantwortet die Frage, mit der man
        eine Anzeige öffnet: Ist das überhaupt ein Beruf mit Zukunft?
        Die persönlichen Zahlen kommen danach.
      */}
      {begruendung.beruf && (
        <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink">
          {begruendung.beruf}
        </p>
      )}

      <p className="text-[15px] leading-relaxed text-ink-2">{begruendung.gesamt}</p>

      {/*
        Als Tabelle: links der Punkt, rechts was Nina dazu sagt.
        
        Untereinander mit der Überschrift ÜBER dem Satz las sich das
        wie drei Absätze — man musste jedes Mal neu zuordnen, worauf
        sich der Satz bezieht. Nebeneinander tut das die Anordnung.
        
        `align-top`, weil die Sätze verschieden lang sind: Ohne das
        stünde der Punkt links auf halber Höhe seines Satzes.
      */}
      <table className="w-full border-collapse text-left">
        <tbody>
          {begruendung.zeilen.map((z, i) => (
            <tr
              key={z.titel}
              /* Trennlinien zwischen den Zeilen, nicht darum herum:
                 Ein Rahmen um die Tabelle machte daraus einen Kasten,
                 und Kästen hat diese Seite genug. */
              className={i > 0 ? "border-t border-line-2" : undefined}
            >
              <th
                scope="row"
                className="w-[11rem] py-2.5 pr-4 align-top abschnitts-titel font-normal text-ink-3"
              >
                {z.titel}
              </th>
              <td className="py-2.5 align-top text-sm leading-relaxed text-ink-2">{z.satz}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/*
        Woraus die Zahl oben rechts entsteht.
        
        Die Passung steht im Kopf als eine Ziffer. Eine Zahl ohne
        Herleitung ist eine Behauptung — und diese hier entscheidet
        mit, ob sich jemand bewirbt.
        
        Deshalb hier die Teilwerte, aus denen sie gemittelt ist, jeder
        mit seinem eigenen Satz. Wer nachrechnen will, kann es; wer
        nur wissen will, woran es liegt, liest die Zeile mit dem
        niedrigsten Wert.
        
        Ein fehlender Teilwert bekommt keinen Prozentwert
        untergeschoben — „—" heisst „dazu weiss ich nichts", und das
        ist etwas anderes als null.
      */}
      {daten.passung !== null && daten.faktoren.length > 0 && (
        <details className="group">
          <summary className="inline-flex min-h-6 cursor-pointer list-none items-center gap-1.5 text-sm text-accent-text underline underline-offset-[3px]">
            Wie kommt die Passung von {daten.passung} % zustande?
          </summary>
          <ul className="mt-2.5 grid gap-2">
            {daten.faktoren.map((f) => (
              <li key={f.key} className="grid gap-0.5">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm">{f.label}</span>
                  <span className="font-mono text-sm tabular text-ink-2">
                    {f.wert === null ? "—" : `${Math.round(f.wert * 100)} %`}
                  </span>
                </span>
                <span className="text-xs leading-relaxed text-ink-3">{f.satz}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/*
        Die drei Listen quer, wie die Tabelle darüber.
        
        Sie standen in drei Spalten nebeneinander, jede mit ihrer
        Überschrift obendrüber. In einer schmalen Spalte wurde daraus
        dreimal ein Wort pro Zeile.
        
        Quer gelesen ist es dieselbe Form wie die Begründung darüber:
        links wovon die Rede ist, rechts was dazu zu sagen ist. Zwei
        Tabellen untereinander lesen sich als eine.
        
        Leere Listen erscheinen gar nicht — „Nichts gefunden" dreimal
        untereinander war die häufigste Ansicht dieses Blocks.
      */}
      {(daten.dafuer.length > 0 || daten.dagegen.length > 0 || daten.offen.length > 0) && (
        <table className="w-full border-collapse text-left">
          <tbody>
            <Zeile titel="Das spricht dafür" punkte={daten.dafuer} />
            <Zeile titel="Darauf solltest du achten" punkte={daten.dagegen} />
            <Zeile titel={`${assistantName} würde noch klären`} punkte={daten.offen} />
          </tbody>
        </table>
      )}

      {/*
        Das Fazit am Ende — was aus allem folgt.
        
        Bewusst keine Wiederholung der Zahl: Wer bis hierher gelesen
        hat, kennt sie. Was er nicht weiss, ist, was er als Nächstes
        tun soll.
      */}
      <p className="max-w-[var(--measure)] border-t border-line-2 pt-3 text-[15px] leading-relaxed text-ink">
        {begruendung.fazit}
      </p>

      {/*
        Der Weg in die Tiefe, am Ende der Kurzfassung.
        
        Was hier steht, erklärt die drei Leisten darüber in wenigen
        Sätzen. Wer wissen will, wie die Anforderungen im Einzelnen
        gegen das Profil stehen, welche Angaben der Anzeige fehlen und
        wie es dem Beruf geht, findet das eine Ebene tiefer.
      */}
      {vollstaendigHref && (
        <a
          href={vollstaendigHref}
          className="inline-flex min-h-6 w-fit items-center gap-1.5 text-sm text-accent-text underline underline-offset-[3px]"
        >
          Ausführliche Analyse
          <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.9} />
        </a>
      )}
    </section>
  );
}

function Zeile({
  titel,
  punkte,
}: {
  titel: string;
  punkte: { key: string; label: string; satz: string }[];
}) {
  /* Ohne Punkte auch keine Zeile. */
  if (punkte.length === 0) return null;

  return (
    <tr className="border-t border-line-2">
      <th
        scope="row"
        className="w-[11rem] py-2.5 pr-4 align-top abschnitts-titel font-normal text-ink-3"
      >
        {titel}
      </th>
      <td className="py-2.5 align-top">
        <ul className="grid gap-1.5">
          {/* Höchstens drei. Eine Liste mit acht Punkten wird
              überflogen, eine mit dreien gelesen. Sortiert ist nach
              Gewicht — was der Person am wichtigsten ist, steht oben. */}
          {punkte.slice(0, 3).map((p) => (
            <li key={p.key} className="text-sm leading-relaxed text-ink-2">
              {p.satz}
            </li>
          ))}
        </ul>
      </td>
    </tr>
  );
}
