import Link from "next/link";

/**
 * Was Monday nachts tut — als Bildband, an zwei Orten dasselbe.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Bild und nicht nur Text
 * ══════════════════════════════════════════════════════════════
 *
 * Der Kasten sagte vorher in vier Sätzen, was nachts passiert. Er
 * stimmte, und man las ihn nicht: Ein Textkasten zwischen Textkästen
 * ist die Form, die man überspringt.
 *
 * Das Bild sagt es in einer halben Sekunde — jemand schläft, auf dem
 * Nachttisch liegt das Telefon, darauf eine Meldung. Der Satz daneben
 * muss danach nur noch benennen, was man ohnehin schon verstanden
 * hat.
 *
 * Die Form stammt aus der Vorlage: Foto über die volle Breite, Text
 * links darüber, ein umrandeter Knopf darunter. Dort steht sie über
 * „Nichts mehr verpassen"; hier über derselben Sache.
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
 * handelt.
 */
export function NachtsWeiter({
  ziel = "/register",
  zielwort = "Benachrichtige mich",
  randlos = false,
}: {
  /** Wohin der Knopf führt — je nachdem, ob jemand schon ein Konto hat. */
  ziel?: string;
  zielwort?: string;
  /**
   * Über die volle Fensterbreite, ohne Ecken.
   *
   * Ein Foto, das an den Rändern aufhört, ist eine Abbildung; eines,
   * das über die Kante läuft, ist ein Ort. Abgerundete Ecken gehen
   * dabei weg — eine Rundung braucht einen Rand, an dem sie sichtbar
   * wird, und randlos gibt es keinen.
   *
   * Die SCHRIFT bleibt trotzdem im Raster: Sie steht in einem
   * Behälter mit derselben Breite und demselben Innenabstand wie
   * alles darüber und darunter. Sonst begänne der Text irgendwo am
   * Bildschirmrand statt auf der Kante, an der die Seite steht.
   */
  randlos?: boolean;
}) {
  const raster = "mx-auto w-full max-w-[1240px] px-5 md:px-8";

  return (
    <div id="nachts" className="scroll-mt-24">
      {/*
        `scroll-mt` wegen der Leiste oben: Ohne den Abstand landet die
        Überschrift beim Ankersprung genau darunter.
      */}
      <div className={randlos ? "relative overflow-hidden" : "relative overflow-hidden rounded-(--radius-lg)"}>
        {/*
          Kein `next/image`: Das Bild ist ein festes Stück der Seite,
          201 kB gross und in genau einer Breite gebraucht. Der
          Optimierer bringt hier nichts, was die zusätzliche
          Abhängigkeit von seiner Einrichtung wert wäre.

          `aria-hidden` und leeres `alt`: Das Bild zeigt, was die
          Überschrift daneben sagt. Ein Vorlesegerät würde sonst
          dieselbe Aussage zweimal bringen.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/bilder/nacht.jpg"
          alt=""
          aria-hidden
          width={1600}
          height={900}
          loading="lazy"
          decoding="async"
          className="h-[24rem] w-full object-cover object-center sm:h-[30rem] lg:h-[36rem]"
        />

        {/*
          Der Verlauf ist keine Verzierung.

          Das Foto ist links hell (Bettdecke) und rechts dunkel. Weisse
          Schrift ohne Abdunklung stünde genau dort, wo das Bild am
          hellsten ist. Der Verlauf läuft deshalb von links stark nach
          rechts durchsichtig — er verdeckt das Motiv nicht, er macht
          nur die Seite lesbar, auf der die Schrift steht.
        */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(6,8,14,.88) 0%, rgba(6,8,14,.72) 38%, rgba(6,8,14,.15) 72%, rgba(6,8,14,0) 100%)",
          }}
        />

        <div className="absolute inset-0 flex items-center">
          <div className={randlos ? raster : "w-full px-6 sm:px-10 lg:px-14"}>
            <div className="max-w-[40rem]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
              Während du schläfst
            </p>

            {/*
              Fett und in Grossbuchstaben — die eine Ausnahme.

              Überschriften stehen seit dem Abgleich mit der Vorlage in
              normaler Strichstärke, weil die Grösse den Rang trägt.
              Über einem Foto trägt sie ihn nicht: Dort konkurriert die
              Schrift mit dem Motiv, und nur Gewicht und Versalien
              halten dagegen. Die Vorlage macht an genau dieser Stelle
              dasselbe.
            */}
            <h2 className="mt-4 font-display text-[clamp(2.1rem,4.6vw,3.75rem)] font-bold uppercase leading-[1.08] tracking-[-0.01em] text-white">
              Neue Stellen,
              <br />
              während du schläfst.
            </h2>

            <p className="mt-5 max-w-[34rem] text-[17px] leading-relaxed text-white/80">
              Einmal gesagt, wonach du suchst — den Rest übernimmt Monday. Sie meldet sich nur,
              wenn wirklich etwas passt.
            </p>

            <Link
              href={ziel}
              className="mt-8 inline-flex min-h-14 items-center rounded-(--radius-control) border border-white/50 px-8 text-base font-medium text-white transition-colors hover:bg-white/10"
            >
              {zielwort}
            </Link>
            </div>
          </div>
        </div>
      </div>

      {/*
        Drei Sätze, drei Versprechen — und jedes ist eines, das die
        Anwendung hält. „Keine Nachricht ohne Treffer" ist wörtlich
        gemeint: Der Suchauftrag verschickt nichts, wenn nichts
        gefunden wurde. Eine tägliche Mail mit „heute leider nichts"
        wäre eine Gewohnheit, die man abbestellt.

        Sie stehen unter dem Bild und nicht darauf: Über einem Foto
        liest man eine Überschrift, keine Liste.
      */}
      <ul className={`mt-6 grid gap-3 text-[15px] leading-relaxed text-ink-2 sm:grid-cols-3 sm:gap-6 ${randlos ? raster : ""}`}>
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
    </div>
  );
}
