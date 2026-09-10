import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { Card, Separator } from "@/components/ui";
import { AuffindbarSchalter, ConsentToggles, DangerZone, ExportButton } from "../SettingsClient";
import { standLaden } from "@/lib/nina/einrichtung/speicher";
import { NinaBereich } from "./NinaBereich";
import { EINWILLIGUNGEN } from "@/lib/privacy/einwilligungen";
import { eigeneVorauswahlen } from "@/lib/vorauswahl";

export const metadata: Metadata = { title: "Datenschutz & Daten" };
export const dynamic = "force-dynamic";

/*
 * Die Liste steht in `lib/privacy/einwilligungen.ts`.
 *
 * Sie stand hier als lokale Konstante — und damit nur hier. Wer nicht
 * angemeldet ist, konnte nirgends nachlesen, worin er einwilligen
 * würde. Seit die Sicherheitsseite im öffentlichen Kopf sie ebenfalls
 * zeigt, gäbe es zwei Aufzählungen derselben Einwilligungen, und die
 * laufen auseinander, sobald eine dazukommt.
 */
const CONSENT_TEXT: Record<string, { title: string; body: string }> = Object.fromEntries(
  Object.entries(EINWILLIGUNGEN).map(([k, v]) => [k, { title: v.title, body: v.body }]),
);

/**
 * Privacy Center.
 *
 * Der Satz „unsere Daten liegen in unserer Datenbank“ reicht nicht: auch
 * ein externer Modellanbieter verarbeitet Daten. Deshalb steht hier
 * nicht nur, was gespeichert ist, sondern auch, was das Haus verlässt.
 */
export default async function PrivacySettingsPage() {
  const user = await requireUser();
  const { t, brand, integrations } = await getPageContext();
  const db = await getDb();

  const [consents, evidenceCount, documentCount, einstellungen, vorauswahl] = await Promise.all([
    withUser(db, user.id, (tx) =>
      tx.select().from(schema.consents).where(eq(schema.consents.userId, user.id)),
    ),
    withUser(db, user.id, async (tx) =>
      (
        await tx
          .select({ id: schema.evidenceItems.id })
          .from(schema.evidenceItems)
          .where(
            and(eq(schema.evidenceItems.userId, user.id), isNull(schema.evidenceItems.deletedAt)),
          )
      ).length,
    ),
    withUser(db, user.id, async (tx) =>
      (
        await tx
          .select({ id: schema.documents.id })
          .from(schema.documents)
          .where(eq(schema.documents.userId, user.id))
      ).length,
    ),
    withUser(db, user.id, async (tx) =>
      (
        await tx
          .select({
            auffindbar: schema.userSettings.auffindbar,
            auffindbarSeit: schema.userSettings.auffindbarSeit,
          })
          .from(schema.userSettings)
          .where(eq(schema.userSettings.userId, user.id))
          .limit(1)
      )[0],
    ),
    /* Was aus der Auffindbarkeit tatsächlich geworden ist. */
    eigeneVorauswahlen(user.id),
  ]);

  const consentState = Object.fromEntries(consents.map((c) => [c.kind, c.granted]));

  /*
   * Mondays Einrichtung steht ganz oben.
   *
   * Sie ist das, was die meisten hier suchen: was im Hintergrund
   * passiert. Die Anbieterangaben darunter erklären, wohin Text geht
   * — wichtig, aber selten der Grund, warum jemand diese Seite
   * öffnet.
   */
  const nina = await standLaden(user.id);

  return (
    <div className="grid gap-6">
      <Card>
        <NinaBereich
          start={{
            kontotyp: nina.kontotyp,
            bedienart: nina.bedienart,
            sprachspeicherung: nina.sprachspeicherung,
            stufe: nina.stufe,
            briefingAktiv: nina.briefingAktiv,
            briefingRhythmus: nina.briefingRhythmus,
            briefingZeit: nina.briefingZeit,
            zeitzone: nina.zeitzone,
            kanaele: nina.kanaele,
            widerrufenAm: nina.widerrufenAm ? nina.widerrufenAm.toISOString() : null,
          }}
        />
      </Card>

      <Card className="grid gap-5">
        <div>
          <h2 className="text-lg font-semibold">Was das Haus verlässt</h2>
          <p className="mt-1.5 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Deine Daten liegen in unserer eigenen Datenbank. Für das Gespräch mit{" "}
            {brand.assistantName} wird trotzdem Text an einen Modellanbieter übermittelt — sonst
            gäbe es keine Antwort. Übermittelt wird nur der Kontext, den der jeweilige Schritt
            braucht; Name, Adresse und Kontaktdaten gehören nicht dazu.
          </p>
        </div>

        <dl className="grid gap-3 rounded-(--radius-md) bg-sunken p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-2xs font-medium uppercase tracking-wider text-ink-3">Anbieter</dt>
            <dd className="mt-1">
              {integrations.ai === "connected"
                ? `${integrations.aiProvider} · ${integrations.aiModel}`
                : "Keiner eingerichtet — es werden keine Texte übermittelt"}
            </dd>
          </div>
          <div>
            <dt className="text-2xs font-medium uppercase tracking-wider text-ink-3">
              Training mit deinen Daten
            </dt>
            <dd className="mt-1">
              {consentState.model_training ? "Von dir erlaubt" : "Aus — Voreinstellung"}
            </dd>
          </div>
        </dl>
      </Card>

      {/*
        Die Auffindbarkeit steht VOR den übrigen Einwilligungen.

        Die anderen betreffen, was mit vorhandenen Daten geschieht.
        Diese betrifft, ob überhaupt jemand von einem erfährt — und ist
        damit die weitreichendste auf dieser Seite. Als sechster Haken
        in einer Liste stünde sie zwischen fünf harmloseren.
      */}
      <Card className="grid gap-5">
        <div>
          <h2 className="text-lg font-semibold">Von Unternehmen gefunden werden</h2>
          <p className="mt-1.5 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Standardmässig aus. Ohne diese Einwilligung schlägt {brand.assistantName} dich keinem
            Unternehmen vor — auch nicht anonym.
          </p>
        </div>
        <AuffindbarSchalter an={einstellungen?.auffindbar ?? false} seit={einstellungen?.auffindbarSeit ?? null} />

        {/*
          Was daraus geworden ist — an derselben Stelle wie der Schalter.

          Eine Einwilligung, deren Folgen man nirgends nachsehen kann,
          ist eine Blankounterschrift. Hier steht, was tatsächlich
          entstanden ist, und daneben der Schalter, mit dem es aufhört.
        */}
        <div className="grid gap-2.5 border-t border-line pt-5">
          <h3 className="text-[15px] font-medium text-ink">Was daraus entstanden ist</h3>
          {vorauswahl.anzahl === 0 ? (
            <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
              Bisher nichts. Es hat noch kein Unternehmen einen freigegebenen Bedarf gegen die
              auffindbaren Profile gerechnet — und ohne das entsteht keine Zeile über dich.
            </p>
          ) : (
            <>
              <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
                Du bist {vorauswahl.anzahl}
                {vorauswahl.anzahl === 1 ? " mal" : " mal"} in einer internen Vorauswahl
                aufgetaucht. Niemand hat dabei deinen Namen gesehen, und niemand hat dich
                angeschrieben — sonst stünde es unter Nachrichten.
              </p>
              <ul className="grid gap-2">
                {vorauswahl.zeilen.map((z) => (
                  <li key={z.am.toISOString()} className="grid gap-0.5">
                    <span className="text-sm text-ink-2">
                      {z.am.toLocaleDateString("de-DE")} ·{" "}
                      {z.passung === null ? "Passung nicht ermittelbar" : `Passung ${z.passung} von 100`}
                    </span>
                    {z.offenePunkte.length > 0 && (
                      <span className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
                        Offen geblieben: {z.offenePunkte.join(" · ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
                Welches Unternehmen es war, steht hier nicht — genauso wenig, wie das Unternehmen
                deinen Namen sieht. Aufgedeckt wird nur, wenn beide Seiten es ausdrücklich tun.
              </p>
            </>
          )}
        </div>
      </Card>

      <Card className="grid gap-5">
        <div>
          <h2 className="text-lg font-semibold">{t("settings.consents")}</h2>
          <p className="mt-1.5 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Jede einzeln. Ein Widerruf wirkt sofort und wird mit Zeitpunkt und Fassung
            protokolliert.
          </p>
        </div>
        <ConsentToggles state={consentState} texts={CONSENT_TEXT} />
      </Card>

      <Card className="grid gap-5">
        <div>
          <h2 className="text-lg font-semibold">{t("settings.memory")}</h2>
          <p className="mt-1.5 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            {brand.assistantName} hat {evidenceCount}{" "}
            {evidenceCount === 1 ? "Angabe" : "Angaben"} zu dir gespeichert
            {documentCount > 0
              ? ` und ${documentCount} ${documentCount === 1 ? "Dokument" : "Dokumente"} abgelegt`
              : ""}
            . {t("settings.memoryBody")}
          </p>
        </div>
        <Link
          href="/app/career"
          className="inline-flex items-center gap-2 text-sm font-medium text-accent-text underline underline-offset-[3px]"
        >
          Alle Angaben ansehen und einzeln bearbeiten
          <ArrowRight className="size-3.5" strokeWidth={2} />
        </Link>
      </Card>

      <Card className="grid gap-5">
        <div>
          <h2 className="text-lg font-semibold">{t("settings.exportData")}</h2>
          <p className="mt-1.5 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            {t("settings.exportBody")}
          </p>
        </div>
        <ExportButton label={t("settings.exportData")} />
      </Card>

      <Separator />

      <DangerZone title={t("settings.deleteAccount")} body={t("settings.deleteAccountBody")} />
    </div>
  );
}
