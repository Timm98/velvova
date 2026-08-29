import { LogOut } from "lucide-react";
import { and, count, eq, isNull } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { AppShell } from "@/components/shell/AppShell";
import { logoutAction } from "@/app/(auth)/actions";

/**
 * Das App-Gerüst.
 *
 * Die Sprachumschaltung ist bewusst nicht mehr hier: Sprache und Region
 * werden beim Onboarding gewählt und im Kontomenü geändert. Eine
 * Entscheidung, die man einmal trifft, gehört nicht in die Navigation,
 * die man hundertmal am Tag sieht.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t, brand } = await getPageContext();
  const db = await getDb();

  const [unread] = await withUser(db, user.id, (tx) =>
    tx
      .select({ value: count() })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, user.id),
          isNull(schema.notifications.readAt),
          isNull(schema.notifications.dismissedAt),
        ),
      ),
  );

  return (
    <AppShell
      brandName={brand.name}
      assistantName={brand.assistantName}
      userEmail={user.email}
      userName={user.displayName}
      unreadCount={unread?.value ?? 0}
      labels={{
        home: t("nav.home"),
        assistant: brand.assistantName,
        jobs: t("nav.matches"),
        applications: t("nav.applications"),
        profile: t("nav.careerProfile"),
        growth: t("nav.growth"),
        settings: t("nav.settings"),
        logout: t("nav.logout"),
        skipToContent: t("nav.skipToContent"),
        search: t("nav.search"),
        notifications: t("nav.notifications"),
        languageRegion: t("nav.languageRegion"),
        appearance: t("nav.appearance"),
        privacy: t("nav.privacyData"),
        help: t("nav.help"),
      }}
      onLogout={
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-[--radius-sm] px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
          >
            <LogOut className="size-4 shrink-0 text-ink-3" strokeWidth={1.8} />
            {t("nav.logout")}
          </button>
        </form>
      }
    >
      {children}
    </AppShell>
  );
}
