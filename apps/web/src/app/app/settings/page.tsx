import { brand } from "@paycheck/config";
import { zugangFür } from "@/lib/billing/zugang";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CreditCard } from "lucide-react";
import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { kennung, listSessions, requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { Card, Input, Row, RowGroup } from "@/components/ui";
import { DeviceList } from "./SettingsClient";
import { SaveButton } from "./SettingsForm";
import { updateDisplayName, updatePhone } from "@/lib/account";
import { updateSettings } from "@/lib/privacy";
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

  const [settings, sessions, anmeldewege, zahlungsmittel, nummernstand] = await Promise.all([
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
    /*
     * Verbundene Anmeldewege und hinterlegte Zahlungsmittel.
     *
     * Beide über `withUser`: Die Zeilenrechte hängen an der Sitzung.
     * Ohne sie käme entweder nichts zurück oder, schlimmer, alles.
     *
     * `.catch(() => [])` an beiden: Eine fehlende Tabelle oder ein
     * Rechtefehler soll die Kontoseite nicht abstürzen lassen — die
     * Karte zeigt dann „keine", was in beiden Fällen stimmt.
     */
    withUser(db, user.id, (tx) =>
      tx
        .select({ provider: schema.authAccounts.provider })
        .from(schema.authAccounts)
        .where(eq(schema.authAccounts.userId, user.id)),
    ).catch(() => []),
    withUser(db, user.id, (tx) =>
      tx
        .select({
          id: schema.paymentMethods.id,
          kind: schema.paymentMethods.kind,
          label: schema.paymentMethods.label,
          isDefault: schema.paymentMethods.isDefault,
        })
        .from(schema.paymentMethods)
        .where(eq(schema.paymentMethods.userId, user.id)),
    ).catch(() => []),
    /* Ob die Nummer bestätigt ist, steht am Nutzer und nicht in der
       Sitzung — `SessionUser` trägt sie nicht. */
    withUser(db, user.id, async (tx) =>
      (
        await tx
          .select({ bestaetigtAm: schema.users.phoneVerifiedAt })
          .from(schema.users)
          .where(eq(schema.users.id, user.id))
          .limit(1)
      )[0],
    ).catch(() => undefined),
  ]);

  const zugang = await zugangFür(user.id);

  /*
   * Die Filterzeilen.
   *
   * „Nicht gesetzt" statt eines erfundenen Standards: Ein Radius von
   * 30 km, den niemand eingetragen hat, sähe aus wie eine Entscheidung
   * und wäre eine Vermutung. Wer nichts eingetragen hat, soll das
   * sehen — dann weiss er auch, warum weit entfernte Stellen kommen.
   */
  /* Anzeigenamen der Anmeldeanbieter — der Schlüssel steht klein in
     der Datenbank, die Marke schreibt sich anders. */
  const ANBIETER: Record<string, string> = { google: "Google", apple: "Apple" };

  const ohne = "nicht gesetzt";
  const pendelart: Record<string, string> = {
    car: "Auto",
    public_transport: "Öffentliche",
    bike: "Fahrrad",
    walk: "zu Fuss",
  };
  const filter = [
    { name: "Markt", wert: settings?.jobMarketCountry ?? ohne },
    {
      name: "Suchradius",
      wert: settings?.searchRadiusKm ? `${settings.searchRadiusKm} km` : ohne,
    },
    {
      name: "Höchste Pendelzeit",
      wert: settings?.maxCommuteMinutes ? `${settings.maxCommuteMinutes} min` : ohne,
    },
    { name: "Verkehrsmittel", wert: pendelart[settings?.commuteMode ?? ""] ?? ohne },
    { name: "Umzugsbereit", wert: settings?.willingToRelocate ? "ja" : "nein" },
    {
      name: "Wunschgehalt",
      wert: settings?.desiredSalaryMin
        ? `ab ${Number(settings.desiredSalaryMin).toLocaleString("de-DE")} €`
        : ohne,
    },
  ];

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

        <Card className="grid gap-4">
          <h2 className="text-base font-semibold text-ink">Anmeldedaten</h2>

          {/*
            ══════════════════════════════════════════════════════
            Jede Angabe in einer eigenen Fläche
            ══════════════════════════════════════════════════════

            Vorher standen die vier Angaben als nackte Zeilen
            untereinander. Daneben liegt die Karte „Angaben zur
            Person" mit einem umrandeten Eingabefeld — dieselbe Höhe,
            dieselbe Schrift, aber die eine Seite umrandet und die
            andere nicht. Das las sich, als fehlte hier etwas.

            Jetzt jede Angabe in einer eigenen umrandeten Fläche, wie
            ein Feld — aber als `<dd>`, nicht als `<input>`. Das ist
            der Unterschied, auf den es ankommt: Nichts davon lässt
            sich hier ändern, und ein echtes Eingabefeld, das nichts
            entgegennimmt, wäre ein Versprechen, das kein Knopf
            einlöst. Es SIEHT aus wie ein Feld, weil es daneben eines
            gibt; es IST keines, weil hier nichts einzugeben ist.
          */}
          <dl className="grid gap-3">
            <Angabe titel="E-Mail-Adresse" wert={user.email} />
            <Angabe titel="Passwort" wert="••••••••••••" schreibmaschine />
            {anmeldewege.length > 0 && (
              <Angabe
                titel="Verbundene Anmeldung"
                wert={anmeldewege.map((w) => ANBIETER[w.provider] ?? w.provider).join(", ")}
              />
            )}
          </dl>

          {/*
            Die Nummer ist das einzige Feld hier, das etwas
            entgegennimmt — deshalb ein eigenes Formular mit eigenem
            Knopf und nicht eine weitere Zeile in der Liste darüber.
          */}
          <form action={updatePhone} className="grid gap-1.5">
            <label htmlFor="phone" className="text-sm text-ink-2">
              Telefonnummer
            </label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={user.phone ?? ""}
              placeholder="+49 173 3706718"
              autoComplete="tel"
            />
            <p className="text-2xs leading-relaxed text-ink-3">
              {user.phone && !nummernstand?.bestaetigtAm
                ? "Eingetragen, aber noch nicht bestätigt. Zum Anmelden per SMS taugt sie erst, wenn ein Code an sie ankam."
                : "Für Rückfragen und die Anmeldung per SMS."}
            </p>
            <div className="mt-1.5">
              <SaveButton />
            </div>
          </form>

          <Link
            href="/forgot-password"
            className="justify-self-start text-sm text-accent-text underline underline-offset-[3px]"
          >
            Passwort zurücksetzen
          </Link>

          {!user.email && (
            <p className="text-2xs leading-relaxed text-ink-3">
              Dieses Konto ist über die Telefonnummer angemeldet. Eine Adresse lässt sich
              nachtragen, sobald die Änderung eingerichtet ist.
            </p>
          )}
        </Card>
      </div>

      {/*
        ══════════════════════════════════════════════════════════
        Wohnort und Filter — hier, nicht nur unter „Sprache & Region"
        ══════════════════════════════════════════════════════════

        Der Wohnort stand bisher ausschliesslich unter „Sprache &
        Region". Dort ist er richtig einsortiert und praktisch nicht
        zu finden: Wer seinen Arbeitsweg eintragen will, sucht ihn
        beim Konto, nicht bei der Sprache.

        Er steht jetzt an beiden Orten — dasselbe Feld, dieselbe
        Serveraktion. `updateSettings` setzt nur, was das Formular
        tatsächlich mitschickt (`ifPresent`), deshalb überschreibt
        dieses kurze Formular keinen der anderen Werte.

        Darunter die Filter als ANSICHT, nicht als zweites Formular.
        Sie hier noch einmal bearbeitbar zu machen hiesse, dieselbe
        Einstellung an zwei Stellen zu pflegen — und die zweite
        vergisst man beim nächsten neuen Feld. Was hier steht, ist
        eine Auskunft mit einem Weg dorthin.
      */}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <form action={updateSettings}>
          <Card className="grid gap-5">
            <div className="grid gap-1">
              <h2 className="text-base font-semibold text-ink">Wohnort und Umkreis</h2>
              <p className="text-2xs leading-relaxed text-ink-3">
                Grundlage für Entfernung und Fahrzeit an jeder Stelle. Stadt oder Postleitzahl
                genügt; Strasse und Hausnummer dürfen dazu.
              </p>
            </div>

            <label className="grid gap-2">
              <span className="text-sm text-ink-2">Wohnort</span>
              <Input
                name="baseLocation"
                defaultValue={settings?.baseLocation ?? ""}
                placeholder="z. B. Hamburg"
                autoComplete="address-level2"
              />
            </label>

            {/*
              Der Radius steht beim Wohnort, nicht bei den Filtern.

              Er ist keine eigene Entscheidung, sondern die zweite
              Hälfte derselben: „von wo" und „wie weit" ergeben erst
              zusammen einen Umkreis. Getrennt trägt man den Ort ein,
              sieht keine Wirkung und sucht den Radius woanders.

              Beide Felder gehen in dasselbe Formular und werden mit
              einem Knopf gespeichert.
            */}
            <label className="grid gap-2">
              <span className="text-sm text-ink-2">Grösster Suchradius</span>
              <Input
                name="searchRadiusKm"
                type="number"
                min={1}
                max={2000}
                defaultValue={settings?.searchRadiusKm ?? ""}
                placeholder="z. B. 40"
                inputMode="numeric"
              />
              <span className="text-2xs leading-relaxed text-ink-3">
                In Kilometern, Luftlinie vom Wohnort. Leer heisst: keine Grenze — dann kommen
                auch Stellen am anderen Ende des Landes.
              </span>
            </label>

            <div>
              <SaveButton />
            </div>
          </Card>
        </form>

        <Card className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="text-base font-semibold text-ink">Deine Filter</h2>
            <p className="text-2xs leading-relaxed text-ink-3">
              Was {brand.assistantName} bei jeder Suche berücksichtigt.
            </p>
          </div>

          <dl className="grid gap-2.5">
            {filter.map((f) => (
              <div key={f.name} className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-ink-2">{f.name}</dt>
                <dd className="text-sm text-ink">{f.wert}</dd>
              </div>
            ))}
          </dl>

          <Link
            href="/app/settings/matching"
            className="justify-self-start text-sm text-accent-text underline underline-offset-[3px]"
          >
            Filter ändern
          </Link>
        </Card>
      </div>

      {/*
        Zahlungsmittel.

        Sie stehen auch unter „Abo & Zahlung" — dort gehören sie hin,
        wenn man etwas ändern will. Hier steht, was hinterlegt IST:
        Wer auf der Kontoseite ist, will das wissen, ohne einen
        Bereich weiter zu klicken, in dem es um Tarife geht.

        Ohne hinterlegtes Mittel steht hier kein leerer Kasten,
        sondern der Satz, der stimmt: Das Produkt ist kostenlos
        nutzbar, und ein Zahlungsmittel braucht erst, wer mehr will.
      */}
      <Card className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-base font-semibold text-ink">Zahlungsmittel</h2>
          <p className="text-2xs leading-relaxed text-ink-3">
            Hinterlegte Zahlungsarten für dein Abo.
          </p>
        </div>

        {zahlungsmittel.length > 0 ? (
          <ul className="grid gap-2.5">
            {zahlungsmittel.map((z) => (
              <li key={z.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <CreditCard aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={1.8} />
                <span className="text-sm text-ink">{z.label ?? z.kind}</span>
                {z.isDefault && (
                  <span className="rounded-(--radius-chip) bg-soft px-2 py-0.5 text-2xs text-ink-2">
                    Standard
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-relaxed text-ink-2">
            Keines hinterlegt. Velvova ist ohne Zahlungsmittel nutzbar — eines braucht erst, wer
            ein Abo abschliesst.
          </p>
        )}

        <Link
          href="/app/settings/abo"
          className="justify-self-start text-sm text-accent-text underline underline-offset-[3px]"
        >
          Abo & Zahlung verwalten
        </Link>
      </Card>

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

/**
 * Eine unveränderliche Angabe — Beschriftung darüber, Wert in einer
 * eigenen Fläche.
 *
 * `text-ink-3` statt `text-ink`, wenn nichts hinterlegt ist: Der
 * Platzhalter soll sich vom Wert unterscheiden, sonst liest man
 * „nicht hinterlegt" als Eintrag.
 */
function Angabe({
  titel,
  wert,
  schreibmaschine = false,
}: {
  titel: string;
  wert: string | null | undefined;
  /** Für Punktreihen: gleiche Zeichenbreite, sonst tanzen sie. */
  schreibmaschine?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <dt className="text-sm text-ink-2">{titel}</dt>
      <dd
        className={`flex min-h-11 items-center rounded-(--radius-control) border border-line px-3 text-sm ${
          wert ? (schreibmaschine ? "font-mono text-ink" : "text-ink") : "text-ink-3"
        }`}
      >
        {wert || "nicht hinterlegt"}
      </dd>
    </div>
  );
}
