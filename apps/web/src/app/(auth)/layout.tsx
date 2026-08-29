import Link from "next/link";
import { getPageContext } from "@/lib/locale";
import { LocaleToggle, ThemeToggle } from "@/components/ThemeToggle";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t, brand, locale } = await getPageContext();

  return (
    <div style={{ minHeight: "100dvh", display: "grid", gridTemplateRows: "auto 1fr auto" }}>
      <header
        style={{
          padding: "var(--space-4) var(--space-5)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--space-4)",
        }}
      >
        <Link href="/" style={{ fontWeight: 600, textDecoration: "none" }}>
          {brand.name}
        </Link>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <LocaleToggle current={locale} />
          <ThemeToggle
            labels={{
              light: t("settings.themeLight"),
              dark: t("settings.themeDark"),
              system: t("settings.themeSystem"),
              group: t("settings.theme"),
            }}
          />
        </div>
      </header>

      <main
        id="inhalt"
        style={{ display: "grid", placeItems: "center", padding: "var(--space-5)" }}
      >
        <div style={{ width: "100%", maxWidth: 420 }}>{children}</div>
      </main>

      <footer
        style={{
          padding: "var(--space-5)",
          textAlign: "center",
          fontSize: "var(--text-sm)",
          color: "var(--text-muted)",
        }}
      >
        <Link href="/privacy" style={{ textDecoration: "none" }}>
          Datenschutz
        </Link>
      </footer>
    </div>
  );
}
