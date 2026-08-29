import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { AppShell } from "@/components/shell/AppShell";
import { logoutAction } from "@/app/(auth)/actions";

/**
 * Das App-Gerüst.
 *
 * Die Sprachumschaltung ist bewusst nicht mehr hier: Sprache und Region
 * werden beim Onboarding gewählt und in den Kontoeinstellungen geändert.
 * Eine Entscheidung, die man einmal trifft, gehört nicht in die
 * Hauptnavigation.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t, brand, isDemoMode } = await getPageContext();

  return (
    <AppShell
      brandName={brand.name}
      userEmail={user.email}
      userName={user.displayName}
      demoMode={isDemoMode}
      labels={{
        home: t("nav.home"),
        assistant: t("nav.assistant"),
        jobs: t("nav.jobs"),
        applications: t("nav.applications"),
        profile: t("nav.profile"),
        settings: t("nav.settings"),
        logout: t("nav.logout"),
        skipToContent: t("nav.skipToContent"),
      }}
      onLogout={
        <form action={logoutAction}>
          <button type="submit">{t("nav.logout")}</button>
        </form>
      }
    >
      {children}
    </AppShell>
  );
}
