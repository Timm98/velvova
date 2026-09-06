import { leistungenAusText } from "@paycheck/jobs";

/**
 * Was die Anzeige an Leistungen nennt — mit dem Satz, in dem es steht.
 *
 * ── Warum der Beleg gleichrangig dasteht ──────────────────────
 *
 * „Altersvorsorge" als Stichwort ist eine Behauptung dieses Produkts
 * über einen Arbeitgeber. Der Satz daneben — „Betriebliche
 * Altersvorsorge mit 20 % Zuschuss" — ist ein Zitat, das jemand im
 * Gespräch vorlesen kann.
 *
 * Der Unterschied zählt hier mehr als anderswo, weil Leistungen die
 * Angaben sind, bei denen sich Anzeige und Wirklichkeit am häufigsten
 * unterscheiden. Wer sich auf ein Stichwort verlässt und im Gespräch
 * merkt, dass es so nicht gemeint war, steht als jemand da, der die
 * Anzeige nicht gelesen hat.
 *
 * ── Warum kein Eurobetrag ─────────────────────────────────────
 *
 * Es wäre naheliegend, „Jobticket" mit 58 € und „30 Tage Urlaub" mit
 * einem Tagessatz zu bewerten und alles zu addieren. Die Summe sähe
 * präzise aus und wäre erfunden: Was ein Jobticket wert ist, hängt
 * daran, ob jemand ohnehin ein Abo hat; was ein Urlaubstag wert ist,
 * hängt am Leben, nicht am Gehalt.
 *
 * Deshalb steht hier, WAS es gibt, und die Bewertung bleibt bei der
 * Person. Eine erfundene Summe im Vergleich zweier Stellen wäre genau
 * der Fehler, den die Nettorechnung nebenan vermeidet.
 */
export function Leistungen({ beschreibung }: { beschreibung: string | null }) {
  const gefunden = leistungenAusText(beschreibung);

  if (gefunden.length === 0) {
    /*
     * Ein Drittel der Anzeigen nennt keine Leistung — das ist die
     * häufigste Auskunft und deshalb ausgeschrieben, statt den
     * Abschnitt verschwinden zu lassen. Ein fehlender Abschnitt sieht
     * aus wie ein Fehler; dieser Satz ist eine Information über die
     * Anzeige.
     */
    return (
      <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-3">
        Diese Anzeige nennt keine Leistungen. Das heisst nicht, dass es keine gibt — es ist eine
        gute Frage fürs Gespräch.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <ul className="grid gap-3">
        {gefunden.map((l) => (
          <li key={l.art} className="grid gap-1">
            <p className="text-sm font-medium text-ink">
              {l.label}
              {l.wert !== null && (
                <span className="ml-2 font-mono text-2xs font-normal text-ink-2">
                  {l.wert} Tage
                </span>
              )}
            </p>
            {/*
             * Das Zitat als Zitat kenntlich: eingerückt, mit Linie.
             * Es ist der Text des Arbeitgebers, nicht unserer.
             */}
            <p className="max-w-[var(--measure)] border-l-2 border-line pl-3 text-2xs leading-relaxed text-ink-3">
              „{l.beleg}"
            </p>
          </li>
        ))}
      </ul>

      <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
        Aus dem Anzeigentext gelesen, nicht bewertet. Was eine Leistung dir wert ist, hängt an
        deinem Leben — ein Jobticket ist wertlos, wenn du ohnehin ein Abo hast.
      </p>
    </div>
  );
}
