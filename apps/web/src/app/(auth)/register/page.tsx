import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPageContext } from "@/lib/locale";
import { currentUser } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Konto anlegen" };

export default async function RegisterPage() {
  if (await currentUser()) redirect("/app");
  const { t } = await getPageContext();

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <h1 style={{ fontSize: "var(--text-2xl)" }}>{t("auth.registerTitle")}</h1>

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

      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", textAlign: "center" }}>
        {t("auth.hasAccount")}{" "}
        <Link href="/login" style={{ color: "var(--accent-text)" }}>
          {t("auth.login")}
        </Link>
      </p>
    </div>
  );
}
