import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPageContext } from "@/lib/locale";
import { currentUser } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Konto anlegen" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await currentUser()) redirect("/app");
  const { t, brand } = await getPageContext();

  return (
    <div className="grid gap-7">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t("auth.registerTitle")}</h1>
        <p className="text-sm text-ink-2">
          Danach führt dich {brand.assistantName} durch die Karriereanalyse.
        </p>
      </div>

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
      />

      <p className="text-center text-sm text-ink-2">
        {t("auth.hasAccount")}{" "}
        <Link href="/login" className="font-medium text-accent-text underline underline-offset-[3px]">
          {t("auth.login")}
        </Link>
      </p>
    </div>
  );
}
