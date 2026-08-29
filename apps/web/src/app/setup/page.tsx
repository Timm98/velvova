import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { saveSetupAction } from "@/app/(auth)/actions";
import { buttonStyle, Card, inputStyle, Stack } from "@/components/ui";

export const metadata: Metadata = { title: "Bevor wir anfangen" };
export const dynamic = "force-dynamic";

/**
 * Einwilligungen und Grundeinstellungen.
 *
 * Jede Einwilligung steht einzeln, mit eigenem Zweck und eigenem Schalter.
 * Das ist der Unterschied zwischen einer Einwilligung und einem Haken:
 * wer nur die Dokumentanalyse ablehnen will, muss nicht alles ablehnen.
 *
 * Die Verarbeitung durch einen externen Anbieter wird ehrlich benannt -
 * einschliesslich des Falls, dass gerade keiner verbunden ist.
 */
export default async function SetupPage() {
  await requireUser();
  const { t, integrations } = await getPageContext();
  const externalAiActive = integrations.ai === "connected";

  const consents = [
    {
      key: "career_profile",
      title: t("consent.careerProfile"),
      body: t("consent.careerProfileBody"),
      defaultOn: true,
      required: true,
    },
    {
      key: "document_analysis",
      title: t("consent.documentAnalysis"),
      body: t("consent.documentAnalysisBody"),
      defaultOn: false,
      required: false,
    },
    {
      key: "voice_input",
      title: t("consent.voiceInput"),
      body: t("consent.voiceInputBody"),
      defaultOn: false,
      required: false,
    },
    {
      key: "transcript_storage",
      title: t("consent.transcriptStorage"),
      body: t("consent.transcriptStorageBody"),
      defaultOn: false,
      required: false,
    },
    {
      key: "external_ai_processing",
      title: t("consent.externalAi"),
      body: externalAiActive ? t("consent.externalAiBodyActive") : t("consent.externalAiBodyInactive"),
      defaultOn: false,
      required: false,
    },
  ];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "var(--space-7) var(--space-5) var(--space-9)" }}>
      <Stack gap={6}>
        <header>
          <h1 style={{ fontSize: "var(--text-2xl)" }}>{t("consent.title")}</h1>
          <p style={{ marginTop: "var(--space-3)", color: "var(--text-secondary)" }}>{t("consent.intro")}</p>
        </header>

        <form action={saveSetupAction}>
          <Stack gap={6}>
            <Card>
              <Stack gap={5}>
                <h2 style={{ fontSize: "var(--text-lg)" }}>Sprache und Ort</h2>

                <div style={{ display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))" }}>
                  <div style={{ display: "grid", gap: "var(--space-2)" }}>
                    <label htmlFor="locale" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                      {t("consent.language")}
                    </label>
                    <select id="locale" name="locale" defaultValue="de" style={inputStyle}>
                      <option value="de">Deutsch</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div style={{ display: "grid", gap: "var(--space-2)" }}>
                    <label htmlFor="country" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                      {t("consent.country")}
                    </label>
                    <select id="country" name="country" defaultValue="DE" style={inputStyle}>
                      <option value="DE">Deutschland</option>
                      <option value="AT">Oesterreich</option>
                      <option value="CH">Schweiz</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "var(--space-2)" }}>
                  <label htmlFor="location" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                    {t("consent.location")}
                  </label>
                  <input
                    id="location"
                    name="location"
                    type="text"
                    placeholder="z. B. Hamburg"
                    autoComplete="address-level2"
                    style={inputStyle}
                  />
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    Nur für die Schätzung von Arbeitswegen. Du kannst das leer lassen.
                  </p>
                </div>

                <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: "var(--space-3)" }}>
                  <legend style={{ fontSize: "var(--text-sm)", fontWeight: 500, padding: 0 }}>
                    {t("consent.workModel")}
                  </legend>
                  <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
                    {[
                      { value: "on_site", label: "Vor Ort" },
                      { value: "hybrid", label: "Hybrid" },
                      { value: "remote", label: "Remote" },
                    ].map((m) => (
                      <label
                        key={m.value}
                        style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minHeight: 44, cursor: "pointer" }}
                      >
                        <input type="checkbox" name="workModel" value={m.value} defaultChecked style={{ width: 20, height: 20 }} />
                        <span style={{ fontSize: "var(--text-sm)" }}>{m.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </Stack>
            </Card>

            <Card>
              <Stack gap={5}>
                <div>
                  <h2 style={{ fontSize: "var(--text-lg)" }}>Deine Einwilligungen</h2>
                  <p style={{ marginTop: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                    Jede einzeln. Jede später widerrufbar.
                  </p>
                </div>

                <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-5)" }}>
                  {consents.map((c) => (
                    <li key={c.key}>
                      <label
                        htmlFor={`consent_${c.key}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "auto 1fr",
                          gap: "var(--space-3)",
                          cursor: "pointer",
                          alignItems: "start",
                        }}
                      >
                        <input
                          id={`consent_${c.key}`}
                          name={`consent_${c.key}`}
                          type="checkbox"
                          defaultChecked={c.defaultOn}
                          required={c.required}
                          aria-describedby={`consent_${c.key}_body`}
                          style={{ width: 20, height: 20, marginTop: 3 }}
                        />
                        <div>
                          <span style={{ fontWeight: 500 }}>
                            {c.title}
                            {c.required && (
                              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · erforderlich</span>
                            )}
                          </span>
                          <p
                            id={`consent_${c.key}_body`}
                            style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 2 }}
                          >
                            {c.body}
                          </p>
                        </div>
                      </label>
                    </li>
                  ))}
                </ul>

                <p style={{ fontSize: "var(--text-sm)" }}>
                  <Link href="/privacy" style={{ color: "var(--accent-text)" }}>
                    {t("consent.privacyCenter")}
                  </Link>
                </p>
              </Stack>
            </Card>

            <button type="submit" style={buttonStyle("primary")}>
              {t("consent.start")}
            </button>
          </Stack>
        </form>
      </Stack>
    </div>
  );
}
