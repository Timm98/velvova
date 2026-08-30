import { LogOut } from "lucide-react";
import { and, count, eq, isNull } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { AppShell } from "@/components/shell/AppShell";
import { NinaProvider } from "@/components/nina/NinaProvider";
import { NinaDock } from "@/components/nina/NinaDock";
import { ensureWorkflowState } from "@/lib/nina/workflow-state";
import { logoutAction } from "@/app/(auth)/actions";

/**
 * Das App-Gerüst.
 *
 * Zwei Dinge hängen daran, dass dieses Layout beim Seitenwechsel
 * bestehen bleibt:
 *
 * 1. **Nina überlebt die Navigation.** Der Provider sitzt hier, also
 *    behält das Gespräch seinen Zustand, während die Seite darunter
 *    ausgetauscht wird. Läge er in einer einzelnen Seite, wäre er nach
 *    jedem Klick weg.
 *
 * 2. **Der Vorgangszustand wird einmal geladen**, nicht auf jeder
 *    Unterseite neu.
 *
 * Die Sprachumschaltung ist bewusst nicht hier: Sprache und Region
 * werden beim Onboarding gewählt und im Kontomenü geändert. Eine
 * Entscheidung, die man einmal trifft, gehört nicht in die Navigation,
 * die man hundertmal am Tag sieht.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t, brand } = await getPageContext();
  const db = await getDb();

  const [unreadRows, workflow] = await Promise.all([
    withUser(db, user.id, (tx) =>
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
    ),
    ensureWorkflowState(user.id),
  ]);

  return (
    <NinaProvider initialConversationId={workflow.activeConversationId}>
      <AppShell
        brandName={brand.name}
        assistantName={brand.assistantName}
        userEmail={user.email}
        userName={user.displayName}
        unreadCount={unreadRows[0]?.value ?? 0}
        labels={{
          home: t("nav.home"),
          discover: t("nav.discover"),
          applications: t("nav.applications"),
          career: t("nav.career"),
          assistant: brand.assistantName,
          settings: t("nav.settings"),
          logout: t("nav.logout"),
          skipToContent: t("nav.skipToContent"),
          search: t("nav.search"),
          notifications: t("nav.notifications"),
          languageRegion: t("nav.languageRegion"),
          appearance: t("nav.appearance"),
          privacy: t("nav.privacyData"),
          help: t("nav.help"),
          expand: t("nav.expand"),
          collapse: t("nav.collapse"),
        }}
        onLogout={
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-(--radius-sm) px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-soft hover:text-ink"
            >
              <LogOut className="size-4 shrink-0 text-ink-3" strokeWidth={1.8} />
              {t("nav.logout")}
            </button>
          </form>
        }
      >
        {children}
      </AppShell>

      {/* Nina auf jeder authentifizierten Seite. Sie liegt außerhalb von
          <AppShell>, damit sie über allem schwebt und nicht im Raster
          des Inhalts steckt. */}
      <NinaDock assistantName={brand.assistantName} />
    </NinaProvider>
  );
}
