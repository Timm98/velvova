import Link from "next/link";
import { getPageContext } from "@/lib/locale";
import { currentUser } from "@/lib/auth";
import { LocaleToggle, ThemeToggle } from "@/components/ThemeToggle";
import { Badge, buttonStyle, Card, Stack } from "@/components/ui";

/**
 * Landing Page.
 *
 * In fünf Sekunden muss klar sein, dass hier vor der Jobbörse angesetzt
 * wird und bis nach der Bewerbung begleitet. Kein erfundenes Kundenlogo,
 * kein Testimonial, keine Erfolgsquote - was wir nicht belegen können,
 * steht nicht hier. Die gezeigten Beispiele sind als Beispiel beschriftet.
 */

export default async function LandingPage() {
  const { t, brand, locale } = await getPageContext();
  const user = await currentUser();

  return (
    <>
      <a href="#inhalt" className="skip-link">
        {t("nav.skipToContent")}
      </a>

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "color-mix(in srgb, var(--surface-page) 88%, transparent)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            maxWidth: 1160,
            margin: "0 auto",
            padding: "var(--space-3) var(--space-5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-4)",
            flexWrap: "wrap",
          }}
        >
          <Link href="/" style={{ fontWeight: 600, fontSize: "var(--text-lg)", textDecoration: "none" }}>
            {brand.name}
          </Link>

          <nav
            aria-label="Hauptnavigation"
            style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}
          >
            <Link
              href="/how-it-works"
              style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", textDecoration: "none" }}
            >
              {t("landing.ctaSecondary")}
            </Link>
            <Link
              href="/methodology"
              style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", textDecoration: "none" }}
            >
              Methodik
            </Link>
            <Link
              href="/privacy"
              style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", textDecoration: "none" }}
            >
              Datenschutz
            </Link>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <LocaleToggle current={locale} />
              <ThemeToggle
                labels={{
                  light: t("settings.themeLight"),
                  dark: t("settings.themeDark"),
                  system: t("settings.themeSystem"),
                  group: t("settings.theme"),
                }}
              />
            </div>
            <Link href={user ? "/app" : "/login"} style={buttonStyle("secondary")}>
              {user ? t("nav.home") : t("auth.login")}
            </Link>
          </nav>
        </div>
      </header>

      <main id="inhalt">
        {/* --- Hero --- */}
        <section
          style={{
            maxWidth: 1160,
            margin: "0 auto",
            padding: "var(--space-9) var(--space-5) var(--space-8)",
          }}
        >
          <div style={{ maxWidth: "22ch" }}>
            <h1
              style={{
                fontSize: "clamp(2.25rem, 5.5vw, var(--text-4xl))",
                lineHeight: "var(--leading-4xl)",
                letterSpacing: "-0.022em",
              }}
            >
              {t("landing.headline")}
            </h1>
          </div>

          <p
            style={{
              marginTop: "var(--space-5)",
              fontSize: "var(--text-lg)",
              color: "var(--text-secondary)",
              maxWidth: "58ch",
              lineHeight: 1.6,
            }}
          >
            {t("landing.subheadline")}
          </p>

          <div
            style={{
              marginTop: "var(--space-7)",
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-3)",
              alignItems: "center",
            }}
          >
            <Link href="/register?mode=voice" style={buttonStyle("primary")}>
              {t("landing.ctaVoice")}
            </Link>
            <Link href="/register?mode=text" style={buttonStyle("secondary")}>
              {t("landing.ctaText")}
            </Link>
            <Link
              href="/how-it-works"
              style={{ ...buttonStyle("quiet"), textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              {t("landing.ctaSecondary")}
            </Link>
          </div>

          <p style={{ marginTop: "var(--space-5)", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
            {t("landing.closingBody")}
          </p>
        </section>

        {/* --- Drei Schritte --- */}
        <section
          aria-labelledby="schritte"
          style={{
            background: "var(--surface-sunken)",
            borderTop: "1px solid var(--border-subtle)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: "var(--space-8) var(--space-5)" }}>
            <h2 id="schritte" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-6)" }}>
              {t("landing.stepsTitle")}
            </h2>
            <ol
              style={{
                listStyle: "none",
                display: "grid",
                gap: "var(--space-5)",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
              }}
            >
              {[
                { n: 1, title: t("landing.step1Title"), body: t("landing.step1Body") },
                { n: 2, title: t("landing.step2Title"), body: t("landing.step2Body") },
                { n: 3, title: t("landing.step3Title"), body: t("landing.step3Body") },
              ].map((s) => (
                <Card as="li" key={s.n}>
                  <Stack gap={3}>
                    <span
                      aria-hidden
                      style={{
                        width: 32,
                        height: 32,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: "var(--radius-full)",
                        background: "var(--accent-subtle)",
                        color: "var(--accent-text)",
                        border: "1px solid var(--accent-border)",
                        fontWeight: 600,
                        fontSize: "var(--text-sm)",
                      }}
                    >
                      {s.n}
                    </span>
                    <h3 style={{ fontSize: "var(--text-lg)" }}>{s.title}</h3>
                    <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{s.body}</p>
                  </Stack>
                </Card>
              ))}
            </ol>
          </div>
        </section>

        {/* --- Erklärbarer Match, als Beispiel gekennzeichnet --- */}
        <section
          aria-labelledby="match"
          style={{ maxWidth: 1160, margin: "0 auto", padding: "var(--space-8) var(--space-5)" }}
        >
          <div style={{ display: "grid", gap: "var(--space-6)", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>
            <div>
              <h2 id="match" style={{ fontSize: "var(--text-xl)" }}>
                {t("landing.matchTitle")}
              </h2>
              <p
                style={{
                  marginTop: "var(--space-3)",
                  color: "var(--text-secondary)",
                  maxWidth: "48ch",
                }}
              >
                {t("landing.matchBody")}
              </p>
            </div>

            <Card>
              <Stack gap={4}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)" }}>
                  <div>
                    <strong>Customer Success Manager</strong>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                      Hamburg · hybrid · 44.000–52.000 EUR
                    </p>
                  </div>
                  <Badge tone="caution">Beispiel</Badge>
                </div>

                <div style={{ display: "flex", gap: "var(--space-6)" }}>
                  <div>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Passung
                    </span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <strong style={{ fontSize: "var(--text-2xl)", color: "var(--positive)", lineHeight: 1 }}>81</strong>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>/ 100</span>
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Sicherheit
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: 6 }}>
                      <span aria-hidden style={{ display: "flex", gap: 2 }}>
                        <span style={{ width: 10, height: 4, borderRadius: 2, background: "var(--caution)" }} />
                        <span style={{ width: 10, height: 4, borderRadius: 2, background: "var(--caution)" }} />
                        <span style={{ width: 10, height: 4, borderRadius: 2, background: "var(--border-default)" }} />
                      </span>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>mittel</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "var(--space-3)", fontSize: "var(--text-sm)" }}>
                  <p>
                    <strong style={{ color: "var(--positive)" }}>Warum sie passt:</strong>{" "}
                    Zwei von zwei Muss-Anforderungen sind durch bestätigte Erfahrungen gedeckt.
                  </p>
                  <p>
                    <strong style={{ color: "var(--caution)" }}>Was du bedenken solltest:</strong>{" "}
                    Zur Arbeitsbelastung liegen keine belastbaren Angaben vor.
                  </p>
                </div>

                <p
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                    borderTop: "1px solid var(--border-subtle)",
                    paddingTop: "var(--space-3)",
                  }}
                >
                  Die Sicherheit ist mittel, weil die Anzeige nichts zur Arbeitszeit sagt und zum
                  Unternehmen nur wenige Stimmen vorliegen. Das senkt die Sicherheit — nicht die Passung.
                </p>
              </Stack>
            </Card>
          </div>
        </section>

        {/* --- Aus Erfahrung wird Beleg --- */}
        <section
          aria-labelledby="evidenz"
          style={{
            background: "var(--surface-sunken)",
            borderTop: "1px solid var(--border-subtle)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: "var(--space-8) var(--space-5)" }}>
            <h2 id="evidenz" style={{ fontSize: "var(--text-xl)" }}>
              {t("landing.evidenceTitle")}
            </h2>
            <p style={{ marginTop: "var(--space-3)", color: "var(--text-secondary)", maxWidth: "56ch" }}>
              {t("landing.evidenceBody")}
            </p>

            <div
              style={{
                marginTop: "var(--space-6)",
                display: "grid",
                gap: "var(--space-4)",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                alignItems: "stretch",
              }}
            >
              <Card style={{ background: "var(--surface-raised)" }}>
                <Stack gap={2}>
                  <Badge tone="neutral">im Lebenslauf</Badge>
                  <p style={{ fontSize: "var(--text-lg)", color: "var(--text-muted)" }}>„Kundenservice, 2 Jahre"</p>
                </Stack>
              </Card>

              <Card>
                <Stack gap={2}>
                  <Badge tone="assistant">was gefragt wird</Badge>
                  <p style={{ fontSize: "var(--text-sm)" }}>
                    „Erzähl von einer Eskalation, die du übernommen hast. Was hast du getan?"
                  </p>
                </Stack>
              </Card>

              <Card>
                <Stack gap={2}>
                  <Badge tone="positive">belegte Stärke</Badge>
                  <p style={{ fontSize: "var(--text-sm)" }}>
                    Vermittelt zwischen Kunde und Technik unter Druck — belegt durch eine konkrete
                    Situation mit benanntem Ergebnis.
                  </p>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    Daraus entsteht eine Rollenidee, die im Lebenslauf nicht stand.
                  </p>
                </Stack>
              </Card>
            </div>
          </div>
        </section>

        {/* --- Quellen getrennt --- */}
        <section
          aria-labelledby="realität"
          style={{ maxWidth: 1160, margin: "0 auto", padding: "var(--space-8) var(--space-5)" }}
        >
          <h2 id="realität" style={{ fontSize: "var(--text-xl)" }}>
            {t("landing.realityTitle")}
          </h2>
          <p style={{ marginTop: "var(--space-3)", color: "var(--text-secondary)", maxWidth: "56ch" }}>
            {t("landing.realityBody")}
          </p>

          <ul
            style={{
              marginTop: "var(--space-6)",
              listStyle: "none",
              display: "grid",
              gap: "var(--space-4)",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
            }}
          >
            {[
              { kind: "Mitarbeiterstimmen", note: "Sagen etwas über die Arbeit. Stichprobe und Zeitraum stehen dabei." },
              { kind: "Kundenbewertungen", note: "Sagen etwas über das Produkt oder den Standort. Nicht über die Kultur." },
              { kind: "Arbeitgeberangaben", note: "Die Selbstdarstellung. Wichtig, aber eine Partei." },
              { kind: "Register und Behörden", note: "Harte Fakten wie Rechtsform und Sitz." },
            ].map((s) => (
              <Card as="li" key={s.kind}>
                <Stack gap={2}>
                  <strong style={{ fontSize: "var(--text-sm)" }}>{s.kind}</strong>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{s.note}</p>
                </Stack>
              </Card>
            ))}
          </ul>
        </section>

        {/* --- Datenschutz --- */}
        <section
          aria-labelledby="datenschutz"
          style={{
            background: "var(--surface-sunken)",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: "var(--space-8) var(--space-5)" }}>
            <div style={{ maxWidth: "56ch" }}>
              <h2 id="datenschutz" style={{ fontSize: "var(--text-xl)" }}>
                {t("landing.privacyTitle")}
              </h2>
              <p style={{ marginTop: "var(--space-3)", color: "var(--text-secondary)" }}>
                {t("landing.privacyBody")}
              </p>
              <p style={{ marginTop: "var(--space-4)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                Eine eigene Datenbank bedeutet nicht automatisch, dass keine Daten einen externen
                Anbieter erreichen. Wo das geschieht, steht es im Privacy Center — mit Zweck,
                Anbieter und Region.
              </p>
              <p style={{ marginTop: "var(--space-5)" }}>
                <Link href="/privacy" style={buttonStyle("secondary")}>
                  {t("consent.privacyCenter")}
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* --- Abschluss --- */}
        <section style={{ maxWidth: 1160, margin: "0 auto", padding: "var(--space-9) var(--space-5)" }}>
          <div style={{ maxWidth: "44ch" }}>
            <h2 style={{ fontSize: "var(--text-2xl)", lineHeight: "var(--leading-2xl)" }}>
              {t("landing.closingTitle")}
            </h2>
            <p style={{ marginTop: "var(--space-4)", color: "var(--text-secondary)" }}>
              {t("landing.closingBody")}
            </p>
            <div style={{ marginTop: "var(--space-6)", display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <Link href="/register?mode=text" style={buttonStyle("primary")}>
                {t("consent.start")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--surface-sunken)" }}>
        <div
          style={{
            maxWidth: 1160,
            margin: "0 auto",
            padding: "var(--space-6) var(--space-5)",
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-5)",
            justifyContent: "space-between",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
          }}
        >
          <span>
            {brand.name} · {brand.assistantName}
            <span style={{ color: "var(--text-muted)" }}> — beide Namen sind vorläufig</span>
          </span>
          <nav aria-label="Rechtliches" style={{ display: "flex", gap: "var(--space-5)", flexWrap: "wrap" }}>
            <Link href="/methodology" style={{ textDecoration: "none" }}>Methodik</Link>
            <Link href="/security" style={{ textDecoration: "none" }}>Sicherheit</Link>
            <Link href="/privacy" style={{ textDecoration: "none" }}>Datenschutz</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
