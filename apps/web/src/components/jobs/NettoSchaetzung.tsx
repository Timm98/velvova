import { alsGeld, rechnerFuer, zuEuro, type Eingabe } from "@/lib/payroll";
import { ArrowDown } from "lucide-react";
import { eingabeAus } from "@/lib/payroll/eingabe";
import { ladeGehaltsangaben } from "@/lib/payroll/einstellungen";
import type { Job } from "@paycheck/domain";
import { LAND_ZU_WAEHRUNG } from "@paycheck/jobs";

/**
 * Was von einem Gehalt voraussichtlich übrig bleibt.
 *
 * Die wichtigste Entscheidung hier ist eine sprachliche, und sie steht
 * über allem anderen: **es wird nie behauptet, dass eine Zahl das Netto
 * IST.** Sie ist eine Schätzung auf Grundlage von Annahmen, und die
 * Annahmen stehen daneben.
 *
 * Der Grund ist nicht Vorsicht, sondern Genauigkeit. Das tatsächliche
 * Netto hängt an Dingen, die eine Stellenanzeige nicht kennt: an der
 * Steuerklasse, an der Krankenkasse, am Bundesland, an Kindern, an
 * Freibeträgen. Wer daraus eine feste Zahl macht, sagt etwas, das er
 * nicht wissen kann — und jemand rechnet damit seine Miete.
 *
 * Deshalb:
 *
 *   „Voraussichtlich bleiben dir etwa …"    statt   „Netto: …"
 *   Bei einer Spanne alle drei Enden        statt   nur der Mittelwert
 *
 * Die Annahmen standen einmal als Pillen darunter. Sie stehen jetzt
 * im Details-Bereich des Rechners — nicht weil sie unwichtig wären,
 * sondern weil fünf Pillen mit Steuerklasse und Kirchensteuersatz über
 * einer Zahl mehr Beipackzettel als Auskunft sind. Der Satz „es wird
 * nie behauptet, dass eine Zahl das Netto IST" gilt unverändert; er
 * steht in der Formulierung, nicht in den Pillen.
 *
 * Und bei einem Land, für das es keine Regeln gibt, steht das da —
 * statt einer deutschen Rechnung mit einem Schweizer Gehalt.
 */

export async function NettoSchaetzung({ job }: { job: Pick<Job, "salary" | "country"> }) {
  const { salary } = job;
  /*
   * Der Betrag entscheidet, nicht `disclosed`.
   *
   * Vorher bekamen die siebzig aus dem Text gelesenen Gehälter kein
   * Netto — obwohl der Bruttobetrag daneben steht. Die Herkunft ist
   * direkt darüber genannt („aus der Stellenbeschreibung gelesen"),
   * also weiss die Person, worauf die Rechnung beruht.
   *
   * Ein Brutto ohne Netto ist an dieser Stelle die schlechtere
   * Auskunft: Die Frage, die jemand tatsächlich hat, bleibt offen.
   */
  if (salary.min === null && salary.max === null) return null;

  // Nur Jahresgehälter. Ein Stundenlohn braucht die Wochenstunden, und
  // die stehen selten in der Anzeige — raten wäre hier teuer.
  if (salary.period !== "year") return null;

  const land = job.country || "DE";

  /*
   * Die Währung muss zum Land passen, sonst wird nicht gerechnet.
   *
   * Bisher entschied allein das Land. Eine Stelle in Frankfurt, deren
   * Gehalt fälschlich als GBP gespeichert war, bekam damit die
   * deutsche Rechnung auf einen Pfundbetrag — und heraus kam ein
   * Nettowert, der überzeugend aussieht und nichts bedeutet.
   *
   * Genau dieser Datensatz existierte: TheirStack lieferte GBP für
   * Frankfurt, der Adapter reichte es durch. Er ist inzwischen
   * richtiggestellt, aber die Rechnung darf sich nicht darauf
   * verlassen, dass so etwas nie wieder vorkommt: Sie bekommt ihre
   * Zahlen aus fremden Daten.
   */
  const erwarteteWaehrung = LAND_ZU_WAEHRUNG[land.toUpperCase()];
  if (erwarteteWaehrung && salary.currency.toUpperCase() !== erwarteteWaehrung) {
    return (
      <p className="text-sm leading-relaxed text-ink-3">
        Das Gehalt ist in {salary.currency} angegeben, die Stelle liegt in {land}. Solange das
        nicht zusammenpasst, rechne ich kein Netto aus.
      </p>
    );
  }

  const rechner = rechnerFuer(land as Eingabe["land"], 2026);

  if (!rechner) {
    /*
     * Kein Regelwerk für dieses Land — und deshalb keine Zahl.
     *
     * Die deutsche Rechnung auf eine Schweizer Stelle anzuwenden ergäbe
     * einen Betrag, der überzeugend aussieht und nichts bedeutet.
     */
    return (
      <p className="text-sm leading-relaxed text-ink-3">
        Für {land} kann ich das Netto noch nicht schätzen — die Regeln dafür fehlen mir.
      </p>
    );
  }

  const von = salary.min ?? salary.max!;
  const bis = salary.max ?? salary.min!;
  const spanne = von !== bis;

  /*
   * Mit den eigenen Steuerangaben, sofern hinterlegt.
   *
   * Vorher rechnete diese Schätzung immer mit festen Annahmen — und
   * verwies darunter auf „Annahmen ändern". Der Link führte zu einem
   * Formular, dessen Werte auf diese Zahl keinen Einfluss hatten. Bei
   * Steuerklasse III statt I sind das mehrere hundert Euro im Monat.
   *
   * `ladeGehaltsangaben` gibt die Voreinstellung zurück, solange
   * niemand etwas gespeichert hat; die Pillen darunter nennen dann
   * genau diese Voreinstellung.
   */
  const angaben = await ladeGehaltsangaben().catch(() => null);

  const unten = rechner.berechne(eingabeAus(angaben, von, land));
  const oben = spanne ? rechner.berechne(eingabeAus(angaben, bis, land)) : unten;

  if (!unten.abgedeckt) {
    return (
      <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-3">{unten.grund}</p>
    );
  }
  if (spanne && !oben.abgedeckt) return null;

  const nettoVon = unten.nettoJahr;
  const nettoBis = oben.abgedeckt ? oben.nettoJahr : unten.nettoJahr;
  const monatVon = unten.nettoMonat;
  const monatBis = oben.abgedeckt ? oben.nettoMonat : unten.nettoMonat;

  return (
    <div className="grid gap-2 pt-1">
      {/*
        Zwei Zeilen statt eines Satzes.
        
        Vorher stand alles in einem Fliesstext: „Voraussichtlich
        bleiben dir etwa 29.950 € – 37.950 € netto pro Jahr — 2.496 €
        – 3.163 € im Monat." Vier Beträge und zwei Zeiträume in einem
        Satz, getrennt durch einen Gedankenstrich; man liest ihn
        zweimal, um zu wissen, welche Zahl welcher Zeitraum ist.
        
        Untereinander mit Beschriftung links beantwortet die Anordnung
        das von selbst. Der einleitende Satz bleibt — er ist die
        Stelle, an der steht, dass es eine Schätzung ist.
      */}
      {/* „nach Steuern" gehört in den Satz: Ohne das liest sich
          „voraussichtlich bleiben dir etwa" wie eine Aussage über das
          Gehalt, und die Zahl darunter ist eine andere als die oben. */}
      <p className="text-sm text-ink-2">Voraussichtlich bleiben dir nach Steuern etwa</p>

      <dl className="grid gap-1.5">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-ink-3">Im Monat</dt>
          <dd className="font-mono text-lg font-semibold tabular">
            {spanne ? `${alsGeld(monatVon)} – ${alsGeld(monatBis)}` : alsGeld(monatVon)}
          </dd>
        </div>
        {/* Der Monat oben, das Jahr darunter: Nach dem Monatsbetrag
            fragt man beim Lesen einer Anzeige zuerst. */}
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-ink-3">Im Jahr</dt>
          <dd className="font-mono tabular text-ink-2">
            {spanne ? `${alsGeld(nettoVon)} – ${alsGeld(nettoBis)}` : alsGeld(nettoVon)}
          </dd>
        </div>
      </dl>

      {/*
       * Die Annahmen als Pillen — sichtbar, nicht im Kleingedruckten.
       *
       * Jede davon verschiebt das Ergebnis um hunderte Euro im Jahr.
       * Wer sie nicht sieht, hält die Zahl für seine.
       */}
      {/*
        Hier standen Annahmen-Pillen, zwei Sätze Vorbehalt, ein Link
        „Annahmen ändern" und die Hinweise des Regelwerks.
        
        Alles entfernt. Über einer Zahl, die jemand lesen will, war das
        mehr Beipackzettel als Auskunft.
        
        Was davon eine Tatsache war, ist eine Tatsache geblieben: Das
        Regelwerk ist nicht gegen die amtlichen Testfälle geprüft,
        `FREIGEGEBEN` steht auf false, und ein Test hält das fest. Die
        Einstellungen unter `/app/settings/gehalt` sind unverändert
        erreichbar.
      */}

      {/*
        Der Weg zum Rechner.
        
        Die Schätzung oben beantwortet „ungefähr wie viel". Wer „mit
        MEINER Steuerklasse wie viel" wissen will, muss zum Rechner —
        und der steht weiter unten in derselben Spalte.
        
        Ein Anker statt eines Knopfes mit Klickbehandlung: Er
        funktioniert ohne JavaScript, die Tastatur erreicht ihn von
        selbst, und der Rollbereich der Spalte scrollt ihn richtig an.
      */}
      <p className="text-sm">
        <a
          href="#gehaltsrechner"
          className="inline-flex min-h-6 items-center gap-1.5 text-accent-text underline underline-offset-[3px]"
        >
          Mit deinen Angaben rechnen
          <ArrowDown aria-hidden className="size-3.5" strokeWidth={1.9} />
        </a>
      </p>
    </div>
  );
}

/** Für Nina und den Jobvergleich: nur die Zahlen, ohne Darstellung. */
export function nettoSchaetzen(bruttoJahr: number, land = "DE") {
  const rechner = rechnerFuer(land as Eingabe["land"], 2026);
  if (!rechner) return null;
  const r = rechner.berechne(eingabeAus(null, bruttoJahr, land));
  if (!r.abgedeckt) return null;
  return {
    nettoJahr: zuEuro(r.nettoJahr),
    nettoMonat: zuEuro(r.nettoMonat),
    abzugsquote: r.abzugsquote,
    regelwerkVersion: r.regelwerkVersion,
    annahmen: r.annahmen,
    hinweise: r.hinweise,
  };
}
