import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GoogleKnopf, Trenner, KNOPF, KNOPF_RAND } from "@/app/(auth)/formstuecke";
import { cn } from "@/lib/cn";

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
        <Link
          href="/app/jobs"
          className={cn(KNOPF, "bg-accent text-accent-on hover:opacity-90 active:translate-y-px")}
        >
          Zu meinen Jobs
          <ArrowRight aria-hidden className="size-4" strokeWidth={2} />
        </Link>
        <Link href="/business" className={cn(KNOPF_RAND, "text-sm")}>
          Zum Unternehmensbereich
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <GoogleKnopf weiter={weiter} />

      {/* Der Trenner steht zwischen Fremdanmeldung und E-Mail, nicht
          unter allem. Er trennt zwei Wege, er schliesst keinen Block ab. */}
      <Trenner />

      <Link href="/register" className={cn(KNOPF_RAND)}>
        Mit E-Mail fortfahren
      </Link>

      {/*
        Zwei Zeilen, keine zwei Knöpfe.

        Anmelden und Unternehmenszugang sind seltener als der Einstieg
        oben. Sie als gleich grosse Flächen zu setzen hiesse, drei
        gleichwertige Angebote zu machen, von denen zwei die meisten
        Besucher nichts angehen.
      */}
      <div className="grid gap-1.5 pt-1 text-sm text-ink-3">
        <p>
          Bereits ein Konto?{" "}
          <Link href="/login" className="text-accent-text underline underline-offset-4 hover:opacity-80">
            Einloggen
          </Link>
        </p>
        <p>
          Für Unternehmen:{" "}
          <Link
            href="/firma"
            className="text-accent-text underline underline-offset-4 hover:opacity-80"
          >
            Unternehmen registrieren
          </Link>
        </p>
      </div>
    </div>
  );
}
