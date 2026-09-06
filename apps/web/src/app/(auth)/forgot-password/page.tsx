import type { Metadata } from "next";
import Link from "next/link";
import { getPageContext } from "@/lib/locale";
import { ForgotForm } from "./ForgotForm";
import { Karte, Titel } from "../Karte";

export const metadata: Metadata = { title: "Passwort vergessen" };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const { t } = await getPageContext();

  return (
    <div className="grid gap-5">
      <Karte>
        <Titel>{t("auth.forgotPassword")}</Titel>

        <p className="text-[15px] leading-relaxed text-ink-2">
          Gib deine Adresse ein. Wenn dazu ein Konto besteht, schicken wir dir einen Link, mit dem
          du dich anmelden und ein neues Passwort setzen kannst.
        </p>

        <ForgotForm
        labels={{ email: t("auth.email"), submit: t("auth.magicLink"), sent: t("auth.magicLinkSent") }}
      />

        <p className="text-center text-[15px] text-ink-2">
          <Link href="/login" className="underline underline-offset-[3px]">
            Zurück zur Anmeldung
          </Link>
        </p>
      </Karte>
    </div>
  );
}
