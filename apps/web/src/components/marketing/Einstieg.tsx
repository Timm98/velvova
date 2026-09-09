import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GoogleKnopf, Trenner } from "@/app/(auth)/formstuecke";

/**
 * Die Knopfstile stehen hier, nicht als Import.
 *
 * `formstuecke.tsx` trägt „use client". Beim Import in eine
 * Server-Komponente ersetzt Next.js das Modul durch einen Verweis:
 * Komponenten werden korrekt durchgereicht, einfache Konstanten
 * dagegen nicht — sie kommen leer an.
 *
 * Genau das war passiert. `cn(KNOPF_RAND)` ergab `class=""`, und
 * „Mit E-Mail fortfahren" stand ohne Rahmen als nackter Text unter
 * einem umrandeten Google-Knopf. Sichtbar wurde es erst auf einem
 * Screenshot; im Code sah alles richtig aus.
 *
 * Die Werte sind dieselben wie in `formstuecke.tsx`. Wenn sich die
 * dort ändern, muss es hier mit — der Preis dafür, dass eine
 * Server-Komponente keine Konstanten aus einem Client-Modul lesen
 * kann.
 */
const KNOPF =
  "inline-flex h-[56px] w-full items-center justify-center gap-3 rounded-[6px] text-[15px] font-medium transition-[background-color,border-color,opacity,transform] duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary)";
const KNOPF_HAUPT = `${KNOPF} bg-accent text-accent-on hover:opacity-90 active:translate-y-px`;
const KNOPF_RAND = `${KNOPF} border border-line-3 bg-transparent text-ink hover:bg-soft active:translate-y-px`;

/**
 * Der Einstieg auf der Startseite — ein Container statt sechs Knöpfe.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das hier steht und nicht auf der Anmeldeseite
 * ══════════════════════════════════════════════════════════════
 *
 * Die Startseite hatte bisher kein Anmeldefeld. Wer sich anmelden
 * wollte, musste erst eine Navigationsentscheidung treffen — und die
 * Seite darüber erklärte in vierzehn Abschnitten, warum sich das
 * lohnt.
 *
 * Jetzt steht der Einstieg dort, wo der Blick zuerst hinfällt. Die
 * Erklärung wandert in die Navigation; wer sie braucht, findet sie.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier bewusst NICHT steht
 * ══════════════════════════════════════════════════════════════
 *
 * **Kein Apple-Knopf.** Er existiert als Bauteil (`AppleKnopf`) und
 * ruft dieselbe Supabase-Anmeldung wie Google. Ob Apple dort
 * eingerichtet ist, lässt sich im Code nicht feststellen — das steht
 * im Supabase-Dashboard. Ein Knopf, der bei jedem Klick scheitert,
 * ist schlimmer als keiner. Sobald die Einrichtung bestätigt ist,
 * genügt hier eine Zeile.
 *
 * **Kein „Ohne Konto ausprobieren".** Einen Gastzugang gibt es im
 * Code nicht. Ihn anzubieten hiesse, einen Weg zu versprechen, der
 * ins Leere führt.
 *
 * **Kein getrennter Registrieren-Knopf je Anbieter.** „Mit Google
 * fortfahren" deckt beides ab; Supabase legt beim ersten Mal an und
 * meldet danach an. Zwei Knöpfe für denselben Weg zwingen zu einer
 * Entscheidung, die niemand treffen kann.
 */
export function Einstieg({
  angemeldet,
  weiter,
}: {
  angemeldet: boolean;
  /** Wohin nach der Anmeldung. Leer heisst: dorthin, wo man herkam. */
  weiter?: string;
}) {
  /*
   * Wer angemeldet ist, braucht keine Anmeldung.
   *
   * Ihm dieselben drei Knöpfe zu zeigen wäre nicht nur nutzlos — es
   * sähe aus, als hätte die Seite ihn vergessen.
   */
  if (angemeldet) {
    return (
      <div className="grid gap-3">
        {/*
          Zu Monday, nicht zur Liste.
          
          „Zu meinen Jobs" führte auf `/app/jobs` — eine Trefferliste.
          Das ist das Ergebnis der Suche und nicht das, was Velvova
          anbietet: Der Satz darüber sagt, dass Monday hilft, Stellen zu
          verstehen und zu vergleichen. Der Knopf darunter führte dann
          an Monday vorbei.
        */}
        <Link
          href="/app/monday"
          className={KNOPF_HAUPT}
        >
          Sprich mit Monday
          <ArrowRight aria-hidden className="size-4" strokeWidth={2} />
        </Link>
        <Link href="/business" className={`${KNOPF_RAND} text-sm`}>
          Zum Unternehmensbereich
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {/*
        Ein umrandeter Kasten, keine losen Knöpfe.

        In der Vorlage steht der Einstieg als eigene Fläche mit Rand —
        und das macht einen Unterschied, den man erst sieht, wenn man
        beides nebeneinander hält: Lose Knöpfe auf dem Seitengrund
        gehören zur Seite. Ein Kasten gehört zusammen, und man erkennt
        auf einen Blick, wo der Einstieg anfängt und aufhört.
      */}
      <div
        className="grid gap-4 rounded-(--radius-lg) border border-line p-5 md:p-6"
        style={{ background: "var(--ed-surface)" }}
      >
        {/*
          E-Mail ist der Hauptknopf, Google der Nebenknopf.

          Vorher war es umgekehrt — Google umrandet, E-Mail umrandet,
          beide gleich stark. Damit trägt keiner die Entscheidung.

          Die Vorlage setzt den gefüllten Knopf auf E-Mail, und das ist
          auch für uns richtig: Google ist ein Angebot für die, die es
          wollen; E-Mail ist der Weg, der bei jedem funktioniert.
        */}
        <GoogleKnopf weiter={weiter} />
        <Trenner />
        <Link href="/register" className={KNOPF_HAUPT}>
          Mit E-Mail fortfahren
        </Link>

        {/*
          Unsere eigenen Rechtstexte, nicht die aus der Vorlage.

          Dort steht eine Einwilligung zu Werbe-E-Mails mit im
          Fortfahren-Satz. Die übernehmen wir ausdrücklich nicht: Eine
          Anmeldung ist keine Einwilligung in Werbung, und eine
          stillschweigende schon gar nicht.
        */}
        <p className="text-xs leading-relaxed text-ink-3">
          Mit dem Fortfahren stimmst du unseren{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:opacity-80">
            Nutzungsbedingungen
          </Link>{" "}
          zu und bestätigst die{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:opacity-80">
            Datenschutzerklärung
          </Link>
          .
        </p>
      </div>

      {/*
        Zwei Zeilen, keine zwei Knöpfe.

        Anmelden und Unternehmenszugang sind seltener als der Einstieg
        oben. Sie als gleich grosse Flächen zu setzen hiesse, drei
        gleichwertige Angebote zu machen, von denen zwei die meisten
        Besucher nichts angehen.

        Sie stehen ausserhalb des Kastens: Der Kasten ist der Einstieg,
        diese beiden sind Abzweigungen davon.
      */}
      <div className="grid gap-1.5 text-sm text-ink-3">
        <p>
          Bereits ein Konto?{" "}
          <Link href="/login" className="text-accent-text underline underline-offset-4 hover:opacity-80">
            Einloggen
          </Link>
        </p>
        <p>
          Für Unternehmen:{" "}
          <Link href="/firma" className="text-accent-text underline underline-offset-4 hover:opacity-80">
            Unternehmen registrieren
          </Link>
        </p>
      </div>
    </div>
  );
}
