import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPageContext } from "@/lib/locale";
import { currentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Karte, Titel } from "../Karte";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Konto anlegen" };
export const dynamic = "force-dynamic";

/**
 * Registrieren — dieselbe Seite wie die Anmeldung, anderer Inhalt.
 *
 * ── Warum wirklich dieselbe ───────────────────────────────────
 *
 * Bis auf Überschrift, Formular und einen zusätzlichen Knopf steht
 * hier Zeile für Zeile dasselbe wie in `login/page.tsx`: gleiche
 * Kartenbreite, gleiche Rundung, gleicher Innenabstand, gleiche
 * Abtrennung unten. Wer von der Anmeldung hierher klickt, soll den
 * Eindruck haben, dass sich der Inhalt der Karte ändert — nicht die
 * Seite.
 *
 * ── Was hier bewusst NICHT mehr steht ─────────────────────────
 *
 * Ein Untertitel („Danach führt dich Monday durch die Karriereanalyse")
 * und die Weiche „Wie möchtest du Velvova nutzen?" mit zwei Kacheln.
 *
 * Der Untertitel machte die Karte höher als die der Anmeldung, und
 * für einen Satz, den niemand liest, bevor er sein Konto anlegt. Die
 * Weiche stellte allen eine Frage, die fast keiner gestellt bekommen
 * muss — wer hier ankommt, sucht Arbeit. Der Weg für Unternehmen
 * steht jetzt als Knopf unter dem Formular.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ absicht?: string; weiter?: string }>;
}) {
  /* Nach `/`, nicht nach `/app`: Dort lag „Heute", und das gibt es
     nicht mehr. Die Startseite begrüsst Angemeldete mit Namen. */
  if (await currentUser()) redirect("/");
  const { t, brand } = await getPageContext();
  const { absicht, weiter } = await searchParams;
  const fuerUnternehmen = absicht === "unternehmen";

  return (
    /*
      `gap-5` statt `gap-8` wie bei der Anmeldung.

      Dort steht nur die Karte in diesem Behälter, hier zusätzlich der
      Rechtssatz darunter. Ein Abstand von 32 Pixeln zwischen beiden
      liesse den Satz wie einen eigenen Abschnitt aussehen — er ist
      aber ein Nachsatz zur Karte. Zwanzig Pixel setzen ihn ab, ohne
      ihn abzutrennen.
    */
    <div className="grid gap-5">
      <Karte>
        <Titel>{fuerUnternehmen ? "Firmenkonto anlegen" : "Konto anlegen"}</Titel>

        <RegisterForm
          labels={{
            email: t("auth.email"),
            password: t("auth.password"),
            passwordHint: t("auth.passwordHint"),
            submit: t("auth.register"),
            errorEmailTaken: t("auth.errorEmailTaken"),
            errorPasswordShort: t("auth.errorPasswordShort"),
            errorEmailInvalid: t("auth.errorEmailInvalid"),
          }}
          weiter={weiter ?? (fuerUnternehmen ? "/business/einrichten" : undefined)}
          supabaseBereit={isSupabaseConfigured()}
          fuerUnternehmen={fuerUnternehmen}
        />

        {/* Ohne Trennlinie: Der Satz gehört noch zur Karte und nicht in
          einen eigenen Abschnitt. Ein Strich darüber machte aus einer
          Zeile einen zweiten Teil — und die Karte damit zweigeteilt,
          obwohl es nur ein Nachsatz ist. */}
        <p className="mt-5 text-center text-[15px] text-ink-2">
          {t("auth.hasAccount")}{" "}
          <Link
            href={weiter ? `/login?weiter=${encodeURIComponent(weiter)}` : "/login"}
            className="font-medium text-accent-text underline underline-offset-[3px]"
          >
            {t("auth.login")}
          </Link>
        </p>
      </Karte>

      {/*
        Der Rechtssatz steht UNTER der Karte, nicht darin.

        Er gehört nicht zum Vorgang, sondern zu dem, was daraus folgt.
        Innerhalb der Karte war er drei Zeilen zwischen dem letzten
        Knopf und dem Rand — Text, den man beim Ausfüllen überliest und
        der die Karte trotzdem um neunzig Pixel höher machte.

        Draussen ist er das Kleingedruckte, das er ist: kleiner
        gesetzt, abgesetzt, und dort, wo man ihn sucht, wenn man ihn
        sucht.

        Nur auf dieser Seite: Wer sich anmeldet, hat die Bedingungen
        beim Anlegen des Kontos bereits angenommen. Sie bei jedem
        Besuch zu wiederholen macht aus einer Zustimmung eine Formel.
      */}
      <p className="mx-auto max-w-[46ch] text-center text-xs leading-relaxed text-ink-3">
        Mit Ihrer Registrierung erklären Sie sich mit den{" "}
        <Link href="/terms" className="underline underline-offset-[3px] hover:text-ink-2">
          Allgemeinen Plattformbedingungen
        </Link>{" "}
        und den{" "}
        <Link href="/privacy" className="underline underline-offset-[3px] hover:text-ink-2">
          Datenschutzbestimmungen
        </Link>{" "}
        von {brand.name} einverstanden.
      </p>
    </div>
  );
}
