import { DIMENSIONSTEXT, type ConfidenceResult, type ConstraintResult, type FitResult } from "@paycheck/domain";
import type { Dimensionsvergleich } from "@paycheck/matching";

/**
 * Vier getrennte Aussagen statt einer Zahl.
 *
 * ── Was hier vorher stand ─────────────────────────────────────
 *
 * Eine Zahl zwischen 0 und 100 und ein Wort dazu: „82 · passt gut".
 * Das ist genau die Angabe, die niemand prüfen kann. Sie verschmilzt
 * vier Dinge, die verschieden sind und verschieden ausgehen können:
 *
 *   Jemand erfüllt die formalen Anforderungen nicht, passt aber
 *   fachlich hervorragend. Jemand kann die Tätigkeit, aber der
 *   Arbeitsalltag würde ihn zermürben. Jemand passt in allem — und
 *   wir wissen fast nichts über ihn.
 *
 * Alle drei ergeben „82".
 *
 * ── Was sich nicht geändert hat ───────────────────────────────
 *
 * Die Rechnung. `computeFit`, `checkConstraints` und
 * `computeConfidence` liefern diese vier Aussagen seit jeher getrennt
 * — die Oberfläche hat sie zusammengeworfen und die Sicherheit ganz
 * weggelassen, obwohl sie berechnet wurde.
 *
 * ── Warum die Sicherheit zuletzt steht ────────────────────────
 *
 * Sie relativiert die drei darüber. Zuerst gelesen wäre sie eine
 * Entschuldigung, zuletzt ist sie die Einordnung.
 */

type Stufe = "gut" | "mittel" | "schwach" | "offen";

const TON: Record<Stufe, string> = {
  gut: "bg-positive-bg text-positive-text",
  mittel: "bg-caution-bg text-caution-text",
  schwach: "bg-critical-bg text-critical-text",
  offen: "bg-inset text-ink-3",
};

const WORT: Record<Stufe, string> = {
  gut: "passt",
  mittel: "teilweise",
  schwach: "passt nicht",
  offen: "unbekannt",
};

/**
 * Aus einem Rohwert eine Stufe.
 *
 * `null` wird `offen` und nicht `schwach`. Der Unterschied ist der
 * ganze Punkt: „wir wissen es nicht" ist keine schlechte Bewertung,
 * und eine fehlende Angabe darf eine Stelle nicht abwerten.
 */
function stufeAus(werte: (number | null)[]): Stufe {
  const bekannt = werte.filter((w): w is number => w !== null);
  if (bekannt.length === 0) return "offen";
  const mittel = bekannt.reduce((a, b) => a + b, 0) / bekannt.length;
  return mittel >= 0.66 ? "gut" : mittel >= 0.4 ? "mittel" : "schwach";
}

function Zeile({
  titel,
  stufe,
  satz,
  wort,
}: {
  titel: string;
  stufe: Stufe;
  satz: string;
  /** Überschreibt das Standardwort — „gering" liest sich bei der Sicherheit richtiger als „unbekannt". */
  wort?: string;
}) {
  return (
    <div className="grid gap-1 border-t border-line py-3 first:border-t-0 first:pt-0 sm:grid-cols-[13rem_1fr] sm:gap-4">
      <div className="flex items-center gap-2">
        <span className={`rounded-(--radius-pill) px-2 py-0.5 abschnitts-titel ${TON[stufe]}`}>
          {wort ?? WORT[stufe]}
        </span>
        <h4 className="text-sm font-medium text-ink">{titel}</h4>
      </div>
      <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">{satz}</p>
    </div>
  );
}

export function Passungsbefund({
  fit,
  confidence,
  bedingungen,
  alltag,
}: {
  fit: FitResult;
  confidence: ConfidenceResult;
  bedingungen: ConstraintResult;
  /**
   * Die Achsen, auf denen Mensch und Stelle vergleichbar sind.
   *
   * Leer, solange der Career Twin nichts hergibt — dann steht in der
   * Zeile „Arbeitsalltag" der alte Wortabgleich, und das ist ehrlicher
   * als zehn erfundene Achsen.
   */
  alltag?: Dimensionsvergleich[];
}) {
  const roh = (key: string) => fit.factors.find((f) => f.key === key)?.raw ?? null;
  const satz = (key: string) => fit.factors.find((f) => f.key === key)?.explanation ?? "";

  /*
   * Die formalen Anforderungen kommen NICHT aus dem Fit.
   *
   * `checkConstraints` prüft Harte gegen Harte: Arbeitszeit, Ort,
   * Gehaltsuntergrenze, Arbeitserlaubnis. Das ist kein Beitrag zu
   * einer Punktzahl, sondern eine Ja/Nein/Unklar-Frage — und
   * `uncertain` wird dabei nie zu `blocked` befördert.
   */
  const formal: Stufe =
    bedingungen.overall === "blocked"
      ? "schwach"
      : bedingungen.overall === "uncertain"
        ? "offen"
        : "gut";

  const formalSatz =
    bedingungen.overall === "blocked"
      ? (bedingungen.blockedBy[0] ?? "Eine deiner harten Bedingungen ist hier nicht erfüllt.")
      : bedingungen.overall === "uncertain"
        ? `Die Anzeige sagt nichts zu: ${bedingungen.uncertainAbout.join(", ") || "einer deiner Bedingungen"}. Das ist kein Ausschluss — nur eine offene Frage für das Gespräch.`
        : "Was du als unverzichtbar angegeben hast, erfüllt diese Stelle.";

  /*
   * Niedrige Sicherheit ist grau, nicht rot.
   *
   * Rot heisst in dieser Oberfläche „das spricht gegen die Stelle".
   * Eine niedrige Sicherheit sagt aber nichts über die Stelle, sondern
   * über unsere Datenlage — bei einem frischen Konto ist sie IMMER
   * niedrig, und dann stünde neben jeder Stelle ein rotes Zeichen für
   * einen Mangel, den die Stelle nicht hat.
   *
   * Die Kernprüfung hält das fest: „Keine roten Balken bei unbekannter
   * Datenlage". Sie hat diesen Fehler gefunden, bevor er jemand sonst
   * gesehen hat.
   */
  /*
   * Der Arbeitsalltag: erst die benannten Achsen, dann der Wortabgleich.
   *
   * `alltag` vergleicht Autonomie, Kundenkontakt, Belastung und die
   * übrigen sieben — Mensch gegen Stelle, und nur dort, wo BEIDE etwas
   * hergeben. Das ist die Auskunft, an der Menschen scheitern, obwohl
   * sie die Arbeit können.
   *
   * Fehlt sie, bleibt es beim alten `work_style`: einer
   * Wortüberschneidung zwischen Freitext und Anzeige. Die misst
   * Vokabular, nicht Passung — aber sie ist besser als nichts, und
   * ehrlicher als eine erfundene Achse.
   */
  const belastbar = (alltag ?? []).filter((v) => v.sicherheit > 0.2);
  const groessterAbstand = belastbar[0];
  const alltagStufe: Stufe =
    belastbar.length === 0
      ? stufeAus([roh("work_style"), roh("values")])
      : groessterAbstand && groessterAbstand.abstand > 0.5
        ? "schwach"
        : groessterAbstand && groessterAbstand.abstand > 0.3
          ? "mittel"
          : "gut";

  const alltagSatz = (() => {
    if (belastbar.length === 0) {
      return (
        satz("work_style") ||
        satz("values") ||
        "Wie der Alltag in dieser Rolle aussieht, gibt die Anzeige nicht her."
      );
    }
    const d = groessterAbstand!;
    const text = DIMENSIONSTEXT[d.dimension];
    if (d.abstand > 0.3) {
      /* Die Achse mit dem grössten belastbaren Abstand ist die
         Auskunft — nicht der Durchschnitt über alle. */
      const stellenSeite = d.stelle > 0.5 ? text.viel : text.wenig;
      const menschSeite = d.mensch > 0.5 ? text.viel : text.wenig;
      return `Diese Stelle geht Richtung „${stellenSeite}", du eher Richtung „${menschSeite}". Erkannt an: ${d.beleg}.`;
    }
    return `Auf ${belastbar.length} von zehn Achsen vergleichbar — die grösste Abweichung liegt bei „${text.frage.replace(/\?$/, "")}", und die ist klein.`;
  })();

  const sicher: Stufe =
    confidence.level === "high" ? "gut" : confidence.level === "medium" ? "mittel" : "offen";

  return (
    <section aria-labelledby="passung" className="grid gap-3">
      <div className="grid gap-1">
        <h3 id="passung" className="abschnitts-titel text-ink-3">
          Passung im Einzelnen
        </h3>
        <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
          Vier Fragen, vier Antworten. Eine Gesamtzahl würde sie zu einer verschmelzen, und dann
          sähe „erfüllt die Anforderungen nicht, passt aber fachlich" genauso aus wie „passt in
          allem, aber wir wissen wenig über dich".
        </p>
      </div>

      <div className="rounded-(--radius-md) bg-inset px-4 py-3">
        <Zeile titel="Formale Anforderungen" stufe={formal} satz={formalSatz} />
        <Zeile
          titel="Fähigkeiten zur Tätigkeit"
          stufe={stufeAus([roh("proven_skills"), roh("preferred_tasks")])}
          satz={satz("proven_skills") || satz("preferred_tasks") || "Zu deinen Fähigkeiten liegt uns für diese Tätigkeit noch nichts Belegtes vor."}
        />
        <Zeile
          titel="Arbeitsalltag zu dir"
          stufe={alltagStufe}
          satz={alltagSatz}
        />
        <Zeile
          titel="Wie sicher diese Einschätzung ist"
          stufe={sicher}
          wort={sicher === "gut" ? "hoch" : sicher === "mittel" ? "mittel" : "gering"}
          satz={
            confidence.reducedBy.length > 0
              ? confidence.reducedBy[0]!
              : "Profil und Anzeige tragen diese Einschätzung."
          }
        />
      </div>

      {/*
       * Was fehlt, gehört unter den Befund — nicht in eine Fussnote.
       *
       * Die Vision verlangt, dass jemand sieht, welche Angaben noch
       * fehlen und was er verbessern müsste. Das steht in
       * `confidence.reducedBy` und war bisher nirgends sichtbar.
       */}
      {confidence.reducedBy.length > 1 && (
        <details className="rounded-(--radius-md) border border-line px-4 py-3">
          <summary className="cursor-pointer text-sm text-ink-2">
            Was diese Einschätzung noch unsicher macht ({confidence.reducedBy.length})
          </summary>
          <ul className="mt-2 grid gap-1.5">
            {confidence.reducedBy.map((r) => (
              <li key={r} className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
                {r}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
