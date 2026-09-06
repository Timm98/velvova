import { Check, Minus, X } from "lucide-react";
import type { ConstraintResult } from "@paycheck/domain";
import { cn } from "@/lib/cn";

/**
 * Deine Bedingungen als Plakettenreihe — auf einen Blick.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum aus derselben Quelle wie der ausführliche Block
 * ══════════════════════════════════════════════════════════════
 *
 * `constraints.checks` ist die Stelle, an der die Anzeige gegen die
 * festgelegten Bedingungen geprüft wird — dieselben Daten, die
 * `Bedingungspruefung` weiter unten in Sätzen ausbreitet.
 *
 * Diese Reihe hier fasst sie zusammen, sie rechnet nichts nach. Eine
 * zweite Ableitung wäre eine zweite Wahrheit: Oben stünde ein Haken,
 * unten ein Kreuz, und beide hätten recht.
 *
 * ══════════════════════════════════════════════════════════════
 * Drei Zustände, nicht zwei
 * ══════════════════════════════════════════════════════════════
 *
 * ✓ erfüllt      — die Anzeige belegt es
 * – offen        — die Anzeige sagt dazu nichts
 * ✗ verletzt     — die Anzeige belegt das Gegenteil
 *
 * „Offen" als Haken zu zeigen wäre die verbreitetste Lüge in
 * Jobbörsen: Was nicht dasteht, gilt dort als erfüllt. Was nicht
 * dasteht, ist aber eine Frage — und die verschwindet, wenn man sie
 * grün färbt.
 */
export function Bedingungsbadges({ ergebnis }: { ergebnis: ConstraintResult }) {
  /*
   * Nur echte Bedingungen.
   *
   * Wo nichts festgelegt wurde, gibt es nichts zu prüfen. Dieselbe
   * Filterung wie im ausführlichen Block — sie steht bewusst in beiden
   * und nicht in einer geteilten Hilfsfunktion, weil sie an einer
   * Formulierung der Prüfung hängt und beim nächsten Umbau dort
   * gemeinsam auffallen soll.
   */
  const zeilen = ergebnis.checks.filter(
    (c) => !/keine (Unter)?[Gg]renze festgelegt/.test(c.reason),
  );
  if (zeilen.length === 0) return null;

  return (
    <ul aria-label="Deine Bedingungen an dieser Stelle" className="flex flex-wrap gap-1.5">
      {zeilen.map((c) => {
        const art =
          c.verdict === "eligible" ? "erfuellt" : c.verdict === "blocked" ? "verletzt" : "offen";
        return (
          <li key={c.key}>
            <span
              /* Der Grund als Titel: Die Plakette sagt DASS, der
                 Titel sagt WARUM — und der ausführliche Block unten
                 sagt es noch einmal für alle, die nicht mit der Maus
                 darauf zeigen können. */
              title={c.reason}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-(--radius-pill) border px-2.5 py-1 text-xs",
                art === "erfuellt"
                  ? "border-positive/50 text-ink-2"
                  : art === "verletzt"
                    ? "border-critical/50 text-critical"
                    : "border-line-2 text-ink-3",
              )}
            >
              {art === "erfuellt" ? (
                <Check aria-hidden className="size-3 text-positive" strokeWidth={2.4} />
              ) : art === "verletzt" ? (
                <X aria-hidden className="size-3" strokeWidth={2.4} />
              ) : (
                <Minus aria-hidden className="size-3" strokeWidth={2.4} />
              )}
              {c.label}
              <span className="sr-only">
                {art === "erfuellt" ? " erfüllt" : art === "verletzt" ? " verletzt" : " offen"}
                {`: ${c.reason}`}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
