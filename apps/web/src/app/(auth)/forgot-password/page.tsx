import type { Metadata } from "next";
import Link from "next/link";
import { getPageContext } from "@/lib/locale";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "Passwort vergessen" };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const { t } = await getPageContext();

  return (
    <div className="grid gap-7">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t("auth.forgotPassword")}</h1>
        <p className="text-sm leading-relaxed text-ink-2">
          Gib deine Adresse ein. Wenn dazu ein Konto besteht, schicken wir dir einen Link, mit dem
          du dich anmelden und ein neues Passwort setzen kannst.
        </p>
      </div>

      <ForgotForm
        labels={{ email: t("auth.email"), submit: t("auth.magicLink"), sent: t("auth.magicLinkSent") }}
      />

      <p className="text-center text-sm">
        <Link href="/login" className="text-ink-2 underline underline-offset-[3px]">
          Zurück zur Anmeldung
        </Link>
      </p>
    </div>
  );
}
