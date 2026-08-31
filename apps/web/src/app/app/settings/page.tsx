import { zugangFür } from "@/lib/billing/zugang";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { listSessions, requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { Input, Row, RowGroup } from "@/components/ui";
import { Section } from "@/components/ui/states";
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
 *
 * Der Aufbau ist Absicht: Überschrift, Erklärung, Zeilen. Keine Karte
 * um jeden Abschnitt, kein Rahmen um jedes Feld. Eine Einstellungsseite,
 * auf der jede Angabe in einem eigenen Kasten sitzt, sieht aus wie ein
 * Verwaltungsformular — und liest sich auch so.
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

  const zugang = await zugangFür(user.id);

  const kurzwege = [
    {
      href: "/app/settings/abo",
      label: "Abo & Zahlung",
      hint:
        zugang.plan === "premium"
          ? "Premium — Plan, Zahlungsart, Rechnungen"
          : "Free — Plan ansehen und vergleichen",
    },
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
  ];

  return (
    <div className="grid gap-10">
      <form action={updateDisplayName}>
        <Section
          title="Wie sollen wir dich ansprechen?"
          description="Der Name erscheint in der Anwendung und in erzeugten Unterlagen. Er wird nicht an das Sprachmodell übermittelt."
        >
          <div className="grid max-w-xl gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium">Name</span>
              <Input
                name="displayName"
                defaultValue={user.displayName ?? ""}
                autoComplete="name"
                placeholder="Vorname Nachname"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium">E-Mail</span>
              <Input value={user.email} readOnly disabled />
              <span className="text-xs text-ink-3">Die Anmeldeadresse. Änderung folgt.</span>
            </label>
          </div>

          <div>
            <SaveButton />
          </div>
        </Section>
      </form>

      <Section
        title={t("settings.sessions")}
        description="Angemeldete Geräte. Abmelden wirkt sofort, auch auf dem betroffenen Gerät."
      >
        <DeviceList
          sessions={sessions.sessions.map((s) => ({ ...s, lastSeenAt: s.lastSeenAt.toISOString() }))}
          total={sessions.total}
        />
      </Section>

      <Section title="Kurzwege">
        {/*
         * Zeilen in einer weichen Gruppe statt einer Liste von Karten.
         * Die Zugehörigkeit trägt die Fläche, die Trennung zwischen den
         * Zeilen eine sehr zarte Linie — als Lesehilfe, nicht als
         * Rahmen.
         */}
        <RowGroup className="max-w-2xl">
          {kurzwege.map((eintrag) => (
            <Link
              key={eintrag.href}
              href={eintrag.href}
              className="block transition-colors hover:bg-soft-hover"
            >
              <Row label={eintrag.label} hint={eintrag.hint}>
                <ChevronRight className="size-4 shrink-0 text-ink-3" strokeWidth={1.8} />
              </Row>
            </Link>
          ))}
        </RowGroup>
      </Section>
    </div>
  );
}
