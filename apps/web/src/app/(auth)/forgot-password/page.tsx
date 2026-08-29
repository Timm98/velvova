import type { Metadata } from "next";
import Link from "next/link";
import { getPageContext } from "@/lib/locale";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "Passwort vergessen" };

export default async function ForgotPasswordPage() {
  const { t } = await getPageContext();

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <h1 style={{ fontSize: "var(--text-2xl)" }}>{t("auth.forgotPassword")}</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
        Gib deine Adresse ein. Wenn dazu ein Konto besteht, schicken wir dir einen Link, mit dem du
        dich anmelden und ein neues Passwort setzen kannst.
      </p>
      <ForgotForm
        labels={{
          email: t("auth.email"),
          submit: t("auth.magicLink"),
          sent: t("auth.magicLinkSent"),
        }}
      />
      <p style={{ textAlign: "center", fontSize: "var(--text-sm)" }}>
        <Link href="/login" style={{ color: "var(--text-secondary)" }}>
          Zurück zur Anmeldung
        </Link>
      </p>
    </div>
  );
}
