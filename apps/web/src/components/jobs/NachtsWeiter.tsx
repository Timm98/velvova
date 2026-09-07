import Link from "next/link";

/**
 * Was Nina nachts tut — als Kasten, an zwei Orten derselbe.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Baustein und keine zweite Seite
 * ══════════════════════════════════════════════════════════════
 *
 * Der Hinweis oben in der Leiste braucht ein Ziel. Eine eigene Seite
 * dafür wäre ein Ort, den man einmal besucht und nie wieder — und der
 * gepflegt werden muss, obwohl er dasselbe sagt wie der Abschnitt auf
 * der Startseite.
 *
 * Stattdessen steht derselbe Kasten unter der Stellenliste. Dort ist
 * er die Antwort auf die Frage, die sich beim Durchsehen stellt: Muss
 * ich das jeden Tag selbst machen?
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier NICHT steht
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Feld für die E-Mail-Adresse. Wer angemeldet ist, hat sie
 * längst hinterlegt — sie ein zweites Mal abzufragen sähe aus, als
 * hätten wir sie vergessen.
 *
 * Und die App-Ankündigung. Sie gehört in den Fussbereich zu den
 * Zahlungsarten, nicht in einen Kasten, der von etwas anderem
 * handelt: Zwei Botschaften in einem Kasten heissen, dass man sich
 * für keine entscheiden konnte.
 */
export function NachtsWeiter({
  ziel = "/register",
  zielwort = "Nachts weitersuchen lassen",
}: {
  /** Wohin der Knopf führt — je nachdem, ob jemand schon ein Konto hat. */
  ziel?: string;
  zielwort?: string;
}) {
  return (
    <div
      id="nachts"
      /* `scroll-mt` wegen der Leiste oben: Ohne den Abstand landet die
         Überschrift beim Ankersprung genau darunter. */
      className="scroll-mt-24 rounded-(--radius-lg) border border-line bg-raised p-6 sm:p-8"
    >
      <p className="abschnitts-titel text-ink-3">Während du schläfst</p>
      <h2 className="mt-3 font-display text-[clamp(1.4rem,2.6vw,2rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
        Nina sucht über Nacht weiter
      </h2>
      <p className="mt-3 max-w-[46rem] text-[16px] leading-relaxed text-ink-2">
        Einmal gesagt, wonach du suchst — den Rest übernimmt sie. Jede Nacht geht
        sie den neuen Bestand durch, prüft ihn gegen deine Bedingungen und legt
        dir am Morgen hin, was übrig bleibt. Nicht alles, was neu ist. Das, was
        passt.
      </p>

      {/*
        Drei Sätze, drei Versprechen — und jedes ist eines, das die
        Anwendung hält. „Keine Nachricht ohne Treffer" ist wörtlich
        gemeint: Der Suchauftrag verschickt nichts, wenn nichts
        gefunden wurde. Eine tägliche Mail mit „heute leider nichts"
        wäre eine Gewohnheit, die man abbestellt.
      */}
      <ul className="mt-6 grid max-w-[40rem] gap-2.5 text-[15px] leading-relaxed text-ink-2">
        <li className="flex gap-3">
          <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent" />
          Du sagst es einmal — in einem Satz, nicht in einem Formular.
        </li>
        <li className="flex gap-3">
          <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent" />
          Keine Nachricht ohne Treffer. Wenn nichts passt, bleibt es still.
        </li>
        <li className="flex gap-3">
          <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent" />
          Jederzeit abstellbar, ohne dass dein Profil davon berührt wird.
        </li>
      </ul>

      <div className="mt-7">
        <Link
          href={ziel}
          className="inline-flex min-h-11 items-center rounded-(--radius-pill) bg-accent px-5 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover"
        >
          {zielwort}
        </Link>
      </div>
    </div>
  );
}
