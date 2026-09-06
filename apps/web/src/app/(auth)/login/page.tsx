import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPageContext } from "@/lib/locale";
import { currentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Karte, Titel } from "../Karte";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Anmelden" };
export const dynamic = "force-dynamic";

/**
 * Warum jemand hier gelandet sein könnte.
 *
 * Ein abgelaufener Anmeldelink schickt zurück auf diese Seite. Ohne
 * Erklärung sähe das aus, als hätte der Link nichts getan — und man
 * würde ihn wieder und wieder anklicken. Der Grund ist bewusst
 * ungenau: „abgelaufen" gilt für abgelaufen, bereits benutzt und
 * erfunden gleichermassen, sonst liesse sich am Unterschied ablesen,
 * ob ein Token je gültig war.
 */
const GRUENDE: Record<string, string> = {
  link_abgelaufen:
    "Dieser Anmeldelink gilt nicht mehr. Links laufen nach zwanzig Minuten ab und lassen sich nur einmal benutzen — fordere unten einfach einen neuen an.",
  zu_viele: "Zu viele Versuche in kurzer Zeit. Warte eine Minute und versuche es noch einmal.",
  /*
   * Der Anbieter ist nicht eingerichtet — heute der Fall bei Apple.
   *
   * Ohne diesen Eintrag kam jemand vom Anbieter zurück und sah eine
   * unveränderte Anmeldeseite: kein Hinweis, keine Erklärung, nur der
   * Eindruck, dass ein Klick nichts bewirkt hat.
   */
  anbieter_aus:
    "Dieser Anmeldeweg ist noch nicht eingerichtet. Melde dich bitte mit deiner E-Mail-Adresse an.",
  anbieter:
    "Die Anmeldung über den externen Anbieter konnte nicht abgeschlossen werden. Bitte versuche es noch einmal.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; weiter?: string }>;
}) {
  /* Nach `/`, nicht nach `/app`: Dort lag „Heute", und das gibt es
     nicht mehr. Die Startseite begrüsst Angemeldete mit Namen. */
  if (await currentUser()) redirect("/");
  const { t, brand } = await getPageContext();
  const parameter = await searchParams;
  const grund = GRUENDE[parameter.fehler ?? ""];

  return (
    <div className="grid gap-8">
      {grund && (
        <p
          role="status"
          className="rounded-(--radius-md) border border-line bg-inset px-4 py-3 text-sm leading-relaxed text-ink-2"
        >
          {grund}
        </p>
      )}

      <Karte>
        <Titel>Einloggen</Titel>

        <LoginForm
          labels={{
            email: t("auth.email"),
            password: t("auth.password"),
            submit: t("auth.login"),
            errorInvalid: t("auth.errorInvalid"),
            errorEmailInvalid: t("auth.errorEmailInvalid"),
            forgot: t("auth.forgotPassword"),
          }}
          weiter={parameter.weiter}
          supabaseBereit={isSupabaseConfigured()}
        />

        {/* Ohne Trennlinie: Der Satz gehört noch zur Karte und nicht in
          einen eigenen Abschnitt. Ein Strich darüber machte aus einer
          Zeile einen zweiten Teil — und die Karte damit zweigeteilt,
          obwohl es nur ein Nachsatz ist. */}
        <p className="text-center text-[15px] text-ink-2">
          Sie sind neu bei {brand.name}?{" "}
          <Link
            href={parameter.weiter ? `/register?weiter=${encodeURIComponent(parameter.weiter)}` : "/register"}
            className="font-medium text-accent-text underline underline-offset-[3px]"
          >
            Jetzt registrieren
          </Link>
        </p>
      </Karte>
    </div>
  );
}
