import { zugangFür } from "@/lib/billing/zugang";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { kennung, listSessions, requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { Card, Input, Row, RowGroup } from "@/components/ui";
import { DeviceList } from "./SettingsClient";
import { SaveButton } from "./SettingsForm";
import { updateDisplayName } from "@/lib/account";
import { Profilbild } from "@/components/shell/Profilbild";
import { profilbildKennung } from "@/lib/profilbild-kennung";

export const metadata: Metadata = { title: "Konto" };
export const dynamic = "force-dynamic";

/**
 * Konto.
 *
 * Die Startseite der Einstellungen. Sie enthält nur, was zum Konto
 * selbst gehört — alles Weitere hat einen eigenen Bereich, damit
 * niemand beim Ändern der Sprache an einem Löschknopf vorbeiscrollt.
 *
 * ── Warum hier jetzt doch Karten stehen ───────────────────────
 *
 * Hier stand das Gegenteil: „Keine Karte um jeden Abschnitt, kein
 * Rahmen um jedes Feld." Die Begründung war, dass eine Seite aus
 * lauter Kästen wie ein Verwaltungsformular aussieht.
 *
 * Sie galt für Kästen mit Schatten und Rahmen um EINZELNE FELDER.
 * Die Karten der Vorlage sind etwas anderes: eine Haarlinie um eine
 * ZUSAMMENGEHÖRIGE GRUPPE, flach, ohne Schatten. Sie umranden nicht
 * jede Angabe, sie fassen zusammen, was zusammengehört — und genau
 * das fehlte hier: vier Abschnitte untereinander, getrennt nur durch
 * Abstand, ohne dass man sah, wo einer aufhört.
 *
 * Was bleibt: kein Rahmen um einzelne Felder.
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
    <div className="grid gap-8">
      {/* Bild und Name als Kopf: die Angabe, an der man erkennt,
          wessen Konto man gerade ansieht. */}
      <Profilbild
        kopf
        bildKennung={profilbildKennung(settings?.avatarPfad)}
        name={user.displayName ?? kennung(user)}
        kennung={user.email ?? user.phone ?? null}
      />

      {/*
        Zwei Karten nebeneinander wie in der Vorlage, darunter die
        breiten. `items-start`, damit die kürzere nicht auf die Höhe
        der längeren gezogen wird — gestreckter Leerraum liest sich
        als vergessener Inhalt.
      */}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <form action={updateDisplayName}>
          <Card className="grid gap-5">
            <div className="grid gap-1">
              <h2 className="text-base font-semibold text-ink">Angaben zur Person</h2>
              <p className="text-2xs leading-relaxed text-ink-3">
                Der Name erscheint in der Anwendung und in erzeugten Unterlagen. Er wird nicht
                an das Sprachmodell übermittelt.
              </p>
            </div>

            <label className="grid gap-2">
              <span className="text-sm text-ink-2">Name</span>
              <Input
                name="displayName"
                defaultValue={user.displayName ?? ""}
                autoComplete="name"
                placeholder="Vorname Nachname"
              />
            </label>

            <div>
              <SaveButton />
            </div>
          </Card>
        </form>

        <Card className="grid gap-5">
          <h2 className="text-base font-semibold text-ink">Anmeldedaten</h2>

          <label className="grid gap-2">
            <span className="text-sm text-ink-2">E-Mail</span>
            <Input value={user.email ?? ""} readOnly disabled />
            {/*
              Ein Konto aus der SMS-Anmeldung hat keine Adresse. Das
              Feld leer zu lassen wäre richtig, aber nicht erklärt —
              der Satz darunter sagt, warum es leer ist und was
              stattdessen die Kennung ist.
            */}
            <span className="text-2xs leading-relaxed text-ink-3">
              {user.email
                ? "Die Anmeldeadresse. Änderung folgt."
                : `Noch keine Adresse hinterlegt. Angemeldet über ${user.phone ?? "eine Telefonnummer"}.`}
            </span>
          </label>
        </Card>
      </div>

      <Card className="grid gap-5">
        <div className="grid gap-1">
          <h2 className="text-base font-semibold text-ink">{t("settings.sessions")}</h2>
          <p className="text-2xs leading-relaxed text-ink-3">
            Angemeldete Geräte. Abmelden wirkt sofort, auch auf dem betroffenen Gerät.
          </p>
        </div>

        <DeviceList
          sessions={sessions.sessions.map((s) => ({ ...s, lastSeenAt: s.lastSeenAt.toISOString() }))}
          total={sessions.total}
        />
      </Card>

      <Card padded={false} className="overflow-hidden">
        <h2 className="px-6 pt-5 pb-3 text-base font-semibold text-ink">Kurzwege</h2>
        {/*
         * Zeilen in einer weichen Gruppe statt einer Liste von Karten.
         * Die Zugehörigkeit trägt die Fläche, die Trennung zwischen den
         * Zeilen eine sehr zarte Linie — als Lesehilfe, nicht als
         * Rahmen.
         */}
        <RowGroup>
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
      </Card>
    </div>
  );
}
