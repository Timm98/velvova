import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPageContext } from "@/lib/locale";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Anmelden" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/app");
  const { t } = await getPageContext();

  return (
    <div className="grid gap-7">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t("auth.loginTitle")}</h1>
        <p className="text-sm text-ink-2">Weiter, wo du aufgehört hast.</p>
      </div>

      <LoginForm
        labels={{
          email: t("auth.email"),
          password: t("auth.password"),
          submit: t("auth.login"),
          magicLink: t("auth.magicLink"),
          magicLinkSent: t("auth.magicLinkSent"),
          errorInvalid: t("auth.errorInvalid"),
          errorEmailInvalid: t("auth.errorEmailInvalid"),
          forgot: t("auth.forgotPassword"),
        }}
      />

      <p className="text-center text-sm text-ink-2">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="font-medium text-accent-text underline underline-offset-[3px]">
          {t("auth.register")}
        </Link>
      </p>
    </div>
  );
}
