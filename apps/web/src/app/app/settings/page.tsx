import type { Metadata } from "next";
import { requireUser, listSessions } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { getDb, schema, withUser } from "@paycheck/db";
import { and, eq, isNull } from "drizzle-orm";
import { updateSettings } from "@/lib/privacy";
import { ConsentToggles, DangerZone, DeviceList, ExportButton } from "./SettingsClient";
import { Card, inputStyle, NotConnected, PageHeader, Stack } from "@/components/ui";

export const metadata: Metadata = { title: "Einstellungen" };
export const dynamic = "force-dynamic";

const CONSENT_TEXT: Record<string, { title: string; body: string }> = {
  career_profile: {
    title: "Karriereprofil",
    body: "Deine Antworten werden gespeichert, damit daraus ein Profil entsteht.",
  },
  document_analysis: {
    title: "Unterlagen auswerten",
    body: "Text aus hochgeladenen Dokumenten wird ausgewertet, um das Profil vorzubefuellen.",
  },
  voice_input: {
    title: "Spracheingabe",
    body: "Du kannst sprechen statt zu schreiben.",
  },
  transcript_storage: {
    title: "Transkript speichern",
    body: "Ohne diese Zustimmung wird gesprochener Text verarbeitet, aber nicht abgelegt.",
  },
  external_ai_processing: {
    title: "Externer KI-Anbieter",
    body: "Texte werden zur Analyse an einen externen Anbieter uebermittelt. Direkte Identifikatoren werden vorher entfernt.",
  },
  model_training: {
    title: "Training von Modellen",
    body: "Standardmaessig aus. Ohne diese ausdrueckliche Zustimmung werden deine Daten nicht fuer Modelltraining verwendet.",
  },
  partner_sharing: {
    title: "Weitergabe an Partner",
    body: "Standardmaessig aus. Ohne diese Zustimmung sehen institutionelle Partner ausschliesslich aggregierte Zahlen, nie dein Profil.",
  },
};

/**
 * Einstellungen und Privacy Center.
 *
 * Der wichtigste Teil ist der untere: einsehen, exportieren, loeschen -
 * und zwar so, dass es tatsaechlich funktioniert.
 */
export default async function SettingsPage() {
  const user = await requireUser();
  const { t, integrations, brand } = await getPageContext();
  const db = await getDb();

  const [settings, consents, evidenceCount, sessions] = await Promise.all([
    withUser(db, user.id, async (tx) =>
      (await tx.select().from(schema.userSettings).where(eq(schema.userSettings.userId, user.id)).limit(1))[0],
    ),
    withUser(db, user.id, (tx) =>
      tx.select().from(schema.consents).where(eq(schema.consents.userId, user.id)),
    ),
    withUser(db, user.id, async (tx) =>
      (
        await tx
          .select()
          .from(schema.evidenceItems)
          .where(and(eq(schema.evidenceItems.userId, user.id), isNull(schema.evidenceItems.deletedAt)))
      ).length,
    ),
    listSessions(user.id),
  ]);

  const consentState = Object.fromEntries(consents.map((c) => [c.kind, c.granted]));

  return (
    <Stack gap={7}>
      <PageHeader title={t("settings.title")} />

      {/* --- Grundeinstellungen --- */}
      <Card>
        <form action={updateSettings}>
          <Stack gap={5}>
            <h2 style={{ fontSize: "var(--text-lg)" }}>Sprache, Ort und Benachrichtigungen</h2>

            <div style={{ display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))" }}>
              <div style={{ display: "grid", gap: "var(--space-2)" }}>
                <label htmlFor="locale" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                  {t("settings.language")}
                </label>
                <select id="locale" name="locale" defaultValue={settings?.locale ?? "de"} style={inputStyle}>
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: "var(--space-2)" }}>
                <label htmlFor="country" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                  {t("settings.region")}
                </label>
                <select id="country" name="country" defaultValue={settings?.country ?? "DE"} style={inputStyle}>
                  <option value="DE">Deutschland</option>
                  <option value="AT">Oesterreich</option>
                  <option value="CH">Schweiz</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: "var(--space-2)" }}>
                <label htmlFor="baseLocation" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                  Standort
                </label>
                <input
                  id="baseLocation"
                  name="baseLocation"
                  type="text"
                  defaultValue={settings?.baseLocation ?? ""}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: "var(--space-2)" }}>
                <label htmlFor="maxCommuteMinutes" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                  Hoechste Pendelzeit (Minuten)
                </label>
                <input
                  id="maxCommuteMinutes"
                  name="maxCommuteMinutes"
                  type="number"
                  min={1}
                  max={600}
                  defaultValue={settings?.maxCommuteMinutes ?? ""}
                  style={inputStyle}
                />
              </div>
            </div>

            <label style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", cursor: "pointer", minHeight: 44 }}>
              <input
                type="checkbox"
                name="notificationEmail"
                defaultChecked={settings?.notificationEmail ?? true}
                style={{ width: 20, height: 20 }}
              />
              <span style={{ fontSize: "var(--text-sm)" }}>Erinnerungen per E-Mail</span>
            </label>

            <div>
              <button
                type="submit"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  border: "1px solid var(--accent)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-3) var(--space-5)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {t("common.save")}
              </button>
            </div>
          </Stack>
        </form>
      </Card>

      {/* --- KI-Verarbeitung, ehrlich --- */}
      <section aria-labelledby="ki">
        <h2 id="ki" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
          {t("settings.aiProvider")}
        </h2>
        {integrations.ai === "mock" ? (
          <NotConnected
            what="Externer KI-Anbieter"
            detail={t("settings.aiProviderMock")}
          />
        ) : (
          <Card>
            <p style={{ fontSize: "var(--text-sm)" }}>{t("settings.aiProviderExternal")}</p>
          </Card>
        )}
      </section>

      {/* --- Verbundene Dienste --- */}
      <section aria-labelledby="dienste">
        <h2 id="dienste" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
          {t("settings.integrations")}
        </h2>
        <Stack gap={3}>
          <NotConnected
            what="E-Mail-Versand"
            detail={
              integrations.mail === "draft-only"
                ? "Es ist kein Postfach verbunden. Bewerbungen werden als Entwurf zum Herunterladen erzeugt und nie automatisch versendet."
                : "Nicht eingerichtet."
            }
          />
          <NotConnected
            what="Objektspeicher"
            detail={
              integrations.storage === "local"
                ? "Hochgeladene Dateien liegen lokal auf diesem Geraet, nicht in einer Cloud."
                : "S3-kompatibler Speicher verbunden."
            }
          />
          <NotConnected
            what="Sprachanbieter"
            detail="Nicht verbunden. Der Sprachmodus nutzt, falls vorhanden, die Erkennung deines Browsers."
          />
        </Stack>
      </section>

      {/* --- Privacy Center --- */}
      <section aria-labelledby="privacy">
        <h2 id="privacy" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-2)" }}>
          {t("settings.privacyCenter")}
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-5)", maxWidth: "var(--measure)" }}>
          Eine eigene Datenbank bedeutet nicht automatisch, dass keine Daten einen externen Anbieter
          erreichen. Hier steht, was tatsaechlich gilt.
        </p>

        <Stack gap={5}>
          <Card>
            <Stack gap={4}>
              <div>
                <h3 style={{ fontSize: "var(--text-base)" }}>{t("settings.consents")}</h3>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>
                  Jede einzeln. Ein Widerruf wirkt sofort und wird protokolliert.
                </p>
              </div>
              <ConsentToggles state={consentState} texts={CONSENT_TEXT} />
            </Stack>
          </Card>

          <Card>
            <Stack gap={4}>
              <div>
                <h3 style={{ fontSize: "var(--text-base)" }}>{t("settings.memory")}</h3>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>
                  {brand.assistantName} hat {evidenceCount} Angaben zu dir gespeichert.{" "}
                  {t("settings.memoryBody")}
                </p>
              </div>
              <a href="/app/profile" style={{ fontSize: "var(--text-sm)", color: "var(--accent-text)" }}>
                Alle Angaben ansehen und bearbeiten →
              </a>
            </Stack>
          </Card>

          <Card>
            <Stack gap={4}>
              <div>
                <h3 style={{ fontSize: "var(--text-base)" }}>{t("settings.sessions")}</h3>
              </div>
              <DeviceList sessions={sessions.map((s) => ({ ...s, lastSeenAt: s.lastSeenAt.toISOString() }))} />
            </Stack>
          </Card>

          <Card>
            <Stack gap={4}>
              <div>
                <h3 style={{ fontSize: "var(--text-base)" }}>{t("settings.exportData")}</h3>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>
                  {t("settings.exportBody")}
                </p>
              </div>
              <ExportButton label={t("settings.exportData")} />
            </Stack>
          </Card>

          <DangerZone
            title={t("settings.deleteAccount")}
            body={t("settings.deleteAccountBody")}
          />
        </Stack>
      </section>
    </Stack>
  );
}
