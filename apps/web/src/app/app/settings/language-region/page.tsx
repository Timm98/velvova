import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { updateSettings } from "@/lib/privacy";
import { Card, Field, Input, Select, Separator } from "@/components/ui";
import { ChipGroup, ChoiceGroup, SaveButton, Toggle } from "../SettingsForm";

export const metadata: Metadata = { title: "Sprache & Region" };
export const dynamic = "force-dynamic";

const COUNTRIES = [
  { code: "DE", name: "Deutschland", currency: "EUR", tz: "Europe/Berlin" },
  { code: "AT", name: "Österreich", currency: "EUR", tz: "Europe/Vienna" },
  { code: "CH", name: "Schweiz", currency: "CHF", tz: "Europe/Zurich" },
];

const TIMEZONES = ["Europe/Berlin", "Europe/Vienna", "Europe/Zurich", "UTC"];

/**
 * Sprache und Region.
 *
 * Die drei Sprachfelder sind bewusst getrennt. Jemand kann die
 * Oberfläche auf Deutsch wollen, mit der Assistenz lieber in seiner
 * Erstsprache reden und die Bewerbung trotzdem auf Englisch schreiben.
 * Ein einziger Schalter würde diese drei Entscheidungen aneinanderketten
 * — und genau deshalb steht hier auch keiner in der Kopfzeile.
 */
export default async function LanguageRegionPage() {
  const user = await requireUser();
  const { brand } = await getPageContext();
  const db = await getDb();

  const settings = await withUser(db, user.id, async (tx) =>
    (
      await tx
        .select()
        .from(schema.userSettings)
        .where(eq(schema.userSettings.userId, user.id))
        .limit(1)
    )[0],
  );

  return (
    <form action={updateSettings} className="grid gap-6">
      <Card className="grid gap-6">
        <div>
          <h2 className="text-lg font-semibold">Sprache</h2>
          <p className="mt-1.5 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Drei getrennte Entscheidungen — deshalb drei Felder.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Oberfläche" htmlFor="locale">
            <Select id="locale" name="locale" defaultValue={settings?.locale ?? "de"}>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </Select>
          </Field>

          <Field label={`Gespräch mit ${brand.assistantName}`} htmlFor="assistantLocale">
            <Select
              id="assistantLocale"
              name="assistantLocale"
              defaultValue={settings?.assistantLocale ?? "de"}
            >
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </Select>
          </Field>

          <Field label="Bewerbungsunterlagen" htmlFor="documentLocale">
            <Select
              id="documentLocale"
              name="documentLocale"
              defaultValue={settings?.documentLocale ?? "de"}
            >
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="grid gap-6">
        <div>
          <h2 className="text-lg font-semibold">Ort und Markt</h2>
          <p className="mt-1.5 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Wohnort und Jobmarkt sind nicht dasselbe. Wer in Basel wohnt, kann auf den deutschen
            Markt schauen.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Wohnsitzland" htmlFor="country">
            <Select id="country" name="country" defaultValue={settings?.country ?? "DE"}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Jobmarkt" htmlFor="jobMarketCountry">
            <Select
              id="jobMarketCountry"
              name="jobMarketCountry"
              defaultValue={settings?.jobMarketCountry ?? "DE"}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Wohnort" htmlFor="baseLocation" hint="Stadt oder Postleitzahl">
            <Input
              id="baseLocation"
              name="baseLocation"
              defaultValue={settings?.baseLocation ?? ""}
              placeholder="z. B. Hamburg"
              autoComplete="address-level2"
            />
          </Field>

          <Field label="Suchradius" htmlFor="searchRadiusKm" hint="In Kilometern. Leer heißt: egal.">
            <Input
              id="searchRadiusKm"
              name="searchRadiusKm"
              type="number"
              min={1}
              max={2000}
              defaultValue={settings?.searchRadiusKm ?? ""}
              placeholder="z. B. 40"
            />
          </Field>

          <Field
            label="Höchste Pendelzeit"
            htmlFor="maxCommuteMinutes"
            hint="Minuten je Richtung."
          >
            <Input
              id="maxCommuteMinutes"
              name="maxCommuteMinutes"
              type="number"
              min={1}
              max={600}
              defaultValue={settings?.maxCommuteMinutes ?? ""}
            />
          </Field>

          <Field label="Zeitzone" htmlFor="timezone">
            <Select id="timezone" name="timezone" defaultValue={settings?.timezone ?? "Europe/Berlin"}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Währung" htmlFor="currency">
            <Select id="currency" name="currency" defaultValue={settings?.currency ?? "EUR"}>
              <option value="EUR">Euro (EUR)</option>
              <option value="CHF">Schweizer Franken (CHF)</option>
            </Select>
          </Field>

          <Field label="Entfernungen" htmlFor="distanceUnit">
            <Select id="distanceUnit" name="distanceUnit" defaultValue={settings?.distanceUnit ?? "km"}>
              <option value="km">Kilometer</option>
              <option value="mi">Meilen</option>
            </Select>
          </Field>
        </div>

        <Separator soft />

        <Toggle
          name="willingToRelocate"
          label="Ich würde für die richtige Stelle umziehen"
          hint="Erweitert die Suche über den Radius hinaus. Ändert nichts an harten Bedingungen."
          defaultChecked={settings?.willingToRelocate ?? false}
        />
      </Card>

      <Card className="grid gap-6">
        <h2 className="text-lg font-semibold">Arbeitsmodell und Vertrag</h2>

        <ChoiceGroup
          name="remotePreference"
          legend="Wie möchtest du arbeiten?"
          defaultValue={settings?.remotePreference ?? "no_preference"}
          options={[
            { value: "remote", label: "Nur remote", description: "Kein regelmäßiger Büroweg." },
            { value: "hybrid", label: "Hybrid", description: "Teils Büro, teils zu Hause." },
            { value: "on_site", label: "Vor Ort", description: "Anwesenheit ist erwünscht." },
            { value: "no_preference", label: "Keine Vorgabe", description: "Zählt nicht in die Passung hinein." },
          ]}
        />

        <Separator soft />

        <ChipGroup
          name="employmentTypes"
          legend="Vertragsarten, die für dich infrage kommen"
          selected={settings?.employmentTypes ?? []}
          options={[
            { value: "permanent", label: "Unbefristet" },
            { value: "fixed_term", label: "Befristet" },
            { value: "working_student", label: "Werkstudium" },
            { value: "internship", label: "Praktikum" },
            { value: "apprenticeship", label: "Ausbildung" },
            { value: "freelance", label: "Freiberuflich" },
            { value: "temp_agency", label: "Zeitarbeit" },
          ]}
        />

        <Separator soft />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Gehaltswunsch (Mindestbetrag)"
            htmlFor="desiredSalaryMin"
            hint="Leer lassen ist in Ordnung. Leer heißt „nicht gesagt“, nicht „null“."
          >
            <Input
              id="desiredSalaryMin"
              name="desiredSalaryMin"
              type="number"
              min={0}
              step={500}
              defaultValue={settings?.desiredSalaryMin ?? ""}
              placeholder="z. B. 48000"
            />
          </Field>

          <Field label="Bezogen auf" htmlFor="desiredSalaryPeriod">
            <Select
              id="desiredSalaryPeriod"
              name="desiredSalaryPeriod"
              defaultValue={settings?.desiredSalaryPeriod ?? "year"}
            >
              <option value="year">Jahr</option>
              <option value="month">Monat</option>
              <option value="hour">Stunde</option>
            </Select>
          </Field>
        </div>
      </Card>

      <div>
        <SaveButton />
      </div>
    </form>
  );
}
