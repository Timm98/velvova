import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPageContext } from "@/lib/locale";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/app");
  const { t } = await getPageContext();

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <h1 style={{ fontSize: "var(--text-2xl)" }}>{t("auth.loginTitle")}</h1>

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

      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", textAlign: "center" }}>
        {t("auth.noAccount")}{" "}
        <Link href="/register" style={{ color: "var(--accent-text)" }}>
          {t("auth.register")}
        </Link>
      </p>
    </div>
  );
}
