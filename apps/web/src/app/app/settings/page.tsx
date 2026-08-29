import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { listSessions, requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { Card, Field, Input, Separator } from "@/components/ui";
import { DeviceList } from "./SettingsClient";
import { SaveButton } from "./SettingsForm";
import { updateDisplayName } from "@/lib/account";

export const metadata: Metadata = { title: "Konto" };
export const dynamic = "force-dynamic";

/**
 * Konto.
 *
 * Die Startseite der Einstellungen. Sie enthält nur, was zum Konto
 * selbst gehört — alles Weitere hat einen eigenen Bereich, damit
 * niemand beim Ändern der Sprache an einem Löschknopf vorbeiscrollt.
 */
export default async function AccountSettingsPage() {
  const user = await requireUser();
  const { t } = await getPageContext();
  const db = await getDb();

  const [settings, sessions] = await Promise.all([
    withUser(db, user.id, async (tx) =>
      (
        await tx
          .select()
          .from(schema.userSettings)
          .where(eq(schema.userSettings.userId, user.id))
          .limit(1)
      )[0],
    ),
    listSessions(user.id),
  ]);

  return (
    <div className="grid gap-6">
      <form action={updateDisplayName}>
        <Card className="grid gap-5">
          <div>
            <h2 className="text-lg font-semibold">Wie sollen wir dich ansprechen?</h2>
            <p className="mt-1.5 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
              Der Name erscheint in der Anwendung und in erzeugten Unterlagen. Er wird nicht an das
              Sprachmodell übermittelt.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" htmlFor="displayName">
              <Input
                id="displayName"
                name="displayName"
                defaultValue={user.displayName ?? ""}
                autoComplete="name"
                placeholder="Vorname Nachname"
              />
            </Field>

            <Field label="E-Mail" htmlFor="email" hint="Die Anmeldeadresse. Änderung folgt.">
              <Input id="email" value={user.email} readOnly disabled />
            </Field>
          </div>

          <div>
            <SaveButton />
          </div>
        </Card>
      </form>

      <Card className="grid gap-5">
        <div>
          <h2 className="text-lg font-semibold">{t("settings.sessions")}</h2>
          <p className="mt-1.5 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Angemeldete Geräte. Abmelden wirkt sofort, auch auf dem betroffenen Gerät.
          </p>
        </div>
        <DeviceList
          sessions={sessions.map((s) => ({ ...s, lastSeenAt: s.lastSeenAt.toISOString() }))}
        />
      </Card>

      <Card className="grid gap-4">
        <h2 className="text-lg font-semibold">Kurzwege</h2>
        <Separator soft />
        <ul className="grid gap-3">
          {[
            {
              href: "/app/settings/language-region",
              label: "Sprache & Region",
              hint: `Oberfläche ${settings?.locale === "en" ? "Englisch" : "Deutsch"}, Markt ${settings?.jobMarketCountry ?? "DE"}`,
            },
            {
              href: "/app/settings/privacy",
              label: "Datenschutz & Daten",
              hint: "Einwilligungen, Export, Löschung",
            },
            {
              href: "/app/settings/integrations",
              label: "Verbundene Dienste",
              hint: "Was in Betrieb ist — und was nicht",
            },
          ].map((row) => (
            <li key={row.href}>
              <Link
                href={row.href}
                className="flex items-center justify-between gap-4 rounded-[--radius-md] px-3 py-2.5 transition-colors hover:bg-sunken"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{row.label}</span>
                  <span className="block truncate text-sm text-ink-3">{row.hint}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-ink-3" strokeWidth={1.8} />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
