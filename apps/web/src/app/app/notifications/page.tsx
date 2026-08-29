import type { Metadata } from "next";
import Link from "next/link";
import { BellOff } from "lucide-react";
import { desc, eq, isNull, and } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { EmptyState, PageHeader } from "@/components/ui/states";

export const metadata: Metadata = { title: "Benachrichtigungen" };
export const dynamic = "force-dynamic";

/**
 * Benachrichtigungen.
 *
 * Beim Öffnen der Seite gelten sie als gelesen. Ein zusätzlicher
 * "Als gelesen markieren"-Knopf wäre Arbeit, die das Produkt der
 * Nutzerin aufbürdet, ohne dass sie etwas davon hat.
 */
export default async function NotificationsPage() {
  const user = await requireUser();
  const db = await getDb();

  const rows = await withUser(db, user.id, (tx) =>
    tx
      .select()
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.dismissedAt)))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(50),
  );

  const unreadIds = rows.filter((r) => r.readAt === null).map((r) => r.id);
  if (unreadIds.length > 0) {
    await withUser(db, user.id, async (tx) => {
      for (const id of unreadIds) {
        await tx
          .update(schema.notifications)
          .set({ readAt: new Date() })
          .where(eq(schema.notifications.id, id));
      }
    });
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Benachrichtigungen"
        lead="Nur, was für deinen nächsten Schritt zählt. Keine Erinnerungen um der Erinnerung willen."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<BellOff className="size-5" strokeWidth={1.7} />}
          title="Nichts Offenes"
          body="Sobald sich an einer Bewerbung etwas tut oder eine Frist näher rückt, steht es hier."
        />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {rows.map((n) => {
              const body = (
                <>
                  <span className="flex items-baseline justify-between gap-4">
                    <span className="text-sm font-medium">{n.title}</span>
                    <span className="shrink-0 text-xs text-ink-3">
                      {new Intl.DateTimeFormat("de-DE", {
                        day: "numeric",
                        month: "short",
                      }).format(n.createdAt)}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-2">{n.body}</span>
                </>
              );

              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link
                      href={n.href}
                      className="block px-6 py-4 transition-colors hover:bg-sunken"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="px-6 py-4">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
