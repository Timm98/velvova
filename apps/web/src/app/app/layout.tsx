import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { LocaleToggle, ThemeToggle } from "@/components/ThemeToggle";
import { AppNav, BottomNav } from "@/components/AppNav";
import { logoutAction } from "@/app/(auth)/actions";
import { DemoBadge } from "@/components/ui";

/**
 * Das App-Geruest.
 *
 * Fuenf Hauptpunkte, nicht mehr. Coaching, Angebote und Check-ins werden
 * aus dem Zusammenhang heraus geoeffnet - sie staendig sichtbar zu halten
 * wuerde die Navigation aufblaehen, ohne dass jemand direkt dorthin
 * springen will.
 *
 * Auf schmalen Geraeten wandert dieselbe Navigation nach unten.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t, brand, locale, isDemoMode } = await getPageContext();

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <a href="#inhalt" className="skip-link">
        {t("nav.skipToContent")}
      </a>

      <header
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--surface-raised)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "var(--space-3) var(--space-5)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-5)",
          }}
        >
          <Link href="/app" style={{ fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
            {brand.name}
          </Link>

          <AppNav
            labels={{
              home: t("nav.home"),
              assistant: t("nav.assistant"),
              jobs: t("nav.jobs"),
              applications: t("nav.applications"),
              profile: t("nav.profile"),
            }}
          />

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div style={{ display: "none" }} className="md-show">
              <LocaleToggle current={locale} />
            </div>
            <ThemeToggle
              labels={{
                light: t("settings.themeLight"),
                dark: t("settings.themeDark"),
                system: t("settings.themeSystem"),
                group: t("settings.theme"),
              }}
            />
            <Link
              href="/app/settings"
              style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", textDecoration: "none" }}
            >
              {t("nav.settings")}
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="compact"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-2) var(--space-3)",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                {t("nav.logout")}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main
        id="inhalt"
        style={{
          flex: 1,
          maxWidth: 1280,
          width: "100%",
          margin: "0 auto",
          padding: "var(--space-6) var(--space-5) var(--space-9)",
        }}
      >
        {isDemoMode && (
          <div style={{ marginBottom: "var(--space-5)" }}>
            <DemoBadge />
          </div>
        )}
        {children}
      </main>

      <BottomNav
        labels={{
          home: t("nav.home"),
          assistant: t("nav.assistant"),
          jobs: t("nav.jobs"),
          applications: t("nav.applications"),
          profile: t("nav.profile"),
        }}
      />

      <p className="sr-only">Angemeldet als {user.email}</p>
    </div>
  );
}
