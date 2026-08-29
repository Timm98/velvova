import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { getDb, schema } from "@paycheck/db";
import { NINA_PROMPT_VERSION } from "@paycheck/ai";
import { SCORING_VERSION } from "@paycheck/domain";
import { desc, sql } from "drizzle-orm";
import { Badge, Card, PageHeader, Stack } from "@/components/ui";

export const metadata: Metadata = { title: "Betrieb" };
export const dynamic = "force-dynamic";

/**
 * Interner Betriebsbereich.
 *
 * Streng rollenbasiert: wer nicht "operator" oder "admin" ist, bekommt
 * 404 - nicht "kein Zugriff". Ein 403 verraet, dass es die Seite gibt.
 *
 * Was hier ausdruecklich NICHT steht: Nutzerchats, Bewerbungsinhalte,
 * Freitexte. Supportzugriff auf Inhalte laeuft ausschliesslich ueber
 * einen begruendeten, protokollierten Ausnahmezugriff (audit_logs mit
 * break_glass), nicht beilaeufig ueber eine Uebersichtsseite.
 */
export default async function AdminPage() {
  const user = await requireUser();
  const { flags, integrations, brand } = await getPageContext();

  if (!flags.adminArea || (user.role !== "operator" && user.role !== "admin")) {
    notFound();
  }

  const db = await getDb();

  const [sources, ingestion, aiRuns, duplicates, stale, privacyRequests, audit] = await Promise.all([
    db.select().from(schema.jobSources),
    db.select().from(schema.jobIngestionRuns).orderBy(desc(schema.jobIngestionRuns.startedAt)).limit(10),
    db.execute(sql`
      SELECT status, count(*)::int AS anzahl, sum(cost_eur_cents)::int AS kosten
      FROM ai_runs GROUP BY status
    `) as unknown as Promise<{ rows: { status: string; anzahl: number; kosten: number | null }[] }>,
    db.execute(sql`
      SELECT content_hash, count(*)::int AS anzahl FROM jobs
      GROUP BY content_hash HAVING count(*) > 1
    `) as unknown as Promise<{ rows: { content_hash: string; anzahl: number }[] }>,
    db.execute(sql`
      SELECT count(*)::int AS anzahl FROM jobs
      WHERE (expires_at IS NOT NULL AND expires_at < now())
         OR (published_at IS NOT NULL AND published_at < now() - interval '60 days')
    `) as unknown as Promise<{ rows: { anzahl: number }[] }>,
    db.select().from(schema.privacyRequests).orderBy(desc(schema.privacyRequests.requestedAt)).limit(10),
    db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(10),
  ]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "var(--space-6) var(--space-5) var(--space-9)" }}>
      <Stack gap={7}>
        <PageHeader
          title="Betrieb"
          lead="Zustand der Quellen, Fassungen und Datenschutzanfragen. Keine Nutzerinhalte."
        />

        <Card style={{ background: "var(--caution-subtle)", borderColor: "var(--caution)" }}>
          <p style={{ fontSize: "var(--text-sm)" }}>
            Diese Seite zeigt bewusst keine Chatverläufe, Bewerbungsinhalte oder Freitexte.
            Supportzugriff auf Inhalte läuft über einen begründeten, protokollierten
            Ausnahmezugriff — nicht über eine Übersicht.
          </p>
        </Card>

        <section aria-labelledby="fassungen">
          <h2 id="fassungen" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
            Fassungen und Modus
          </h2>
          <Card>
            <dl style={{ display: "grid", gap: "var(--space-3)", margin: 0, fontSize: "var(--text-sm)" }}>
              <Row label="Marke" value={`${brand.name} / ${brand.assistantName}`} />
              <Row label="Bewertungslogik" value={SCORING_VERSION} />
              <Row label="Systemprompt" value={NINA_PROMPT_VERSION} />
              <Row label="KI-Anbieter" value={integrations.ai} />
              <Row label="E-Mail" value={integrations.mail} />
              <Row label="Speicher" value={integrations.storage} />
            </dl>
          </Card>
        </section>

        <section aria-labelledby="quellen">
          <h2 id="quellen" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
            Jobquellen
          </h2>
          <Card padded={false}>
            <ul style={{ listStyle: "none" }}>
              {sources.map((s, i) => (
                <li
                  key={s.id}
                  style={{
                    padding: "var(--space-4) var(--space-5)",
                    borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "var(--space-4)",
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    <strong>{s.displayName}</strong>
                    <br />
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                      {s.kind} · Lizenz: {s.licenseStatus}
                      {s.lastRunAt && ` · zuletzt ${new Intl.DateTimeFormat("de-DE").format(s.lastRunAt)}`}
                    </span>
                    {s.lastRunError && (
                      <>
                        <br />
                        <span style={{ fontSize: "var(--text-sm)", color: "var(--critical)" }}>
                          {s.lastRunError}
                        </span>
                      </>
                    )}
                  </span>
                  <Badge tone={s.enabled ? "positive" : "neutral"}>
                    {s.enabled ? "aktiv" : "inaktiv"}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section aria-labelledby="daten" style={{ display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
          <h2 id="daten" className="sr-only">
            Datenqualität
          </h2>
          <Metric label="Doppelte Inhalte" value={duplicates.rows.length} hint="Gleicher Inhaltshash, mögliche Reposts" />
          <Metric label="Veraltete Anzeigen" value={stale.rows[0]?.anzahl ?? 0} hint="Frist abgelaufen oder älter als 60 Tage" />
          <Metric label="Importläufe" value={ingestion.length} hint="Zuletzt erfasste Durchläufe" />
        </section>

        <section aria-labelledby="ki">
          <h2 id="ki" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
            KI-Läufe
          </h2>
          <Card>
            {aiRuns.rows.length === 0 ? (
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                Noch keine Läufe erfasst.
              </p>
            ) : (
              <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)" }}>
                {aiRuns.rows.map((r) => (
                  <li key={r.status} style={{ fontSize: "var(--text-sm)", display: "flex", gap: "var(--space-3)" }}>
                    <Badge tone={r.status === "ok" ? "positive" : "critical"}>{r.status}</Badge>
                    <span>
                      {r.anzahl} Läufe
                      {r.kosten !== null && ` · ${(r.kosten / 100).toFixed(2)} EUR`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p style={{ marginTop: "var(--space-3)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              Nur Zustand und Kostenmetadaten. Weder Anfragen noch Antworten werden hier gezeigt.
            </p>
          </Card>
        </section>

        <section aria-labelledby="datenschutz">
          <h2 id="datenschutz" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
            Datenschutzanfragen
          </h2>
          <Card>
            {privacyRequests.length === 0 ? (
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Keine offenen Anfragen.</p>
            ) : (
              <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-3)" }}>
                {privacyRequests.map((r) => (
                  <li key={r.id} style={{ fontSize: "var(--text-sm)", display: "flex", gap: "var(--space-3)" }}>
                    <Badge tone={r.status === "done" ? "positive" : "caution"}>{r.status}</Badge>
                    <span>
                      {r.kind} · {new Intl.DateTimeFormat("de-DE").format(r.requestedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section aria-labelledby="audit">
          <h2 id="audit" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
            Audit-Log
          </h2>
          <Card>
            {audit.length === 0 ? (
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Keine Einträge.</p>
            ) : (
              <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-3)" }}>
                {audit.map((a) => (
                  <li key={a.id} style={{ fontSize: "var(--text-sm)" }}>
                    {a.breakGlass && <Badge tone="critical">Ausnahmezugriff</Badge>} {a.action}
                    {a.justification && (
                      <>
                        <br />
                        <span style={{ color: "var(--text-muted)" }}>Begründung: {a.justification}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </Stack>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
      <dt style={{ color: "var(--text-muted)", minWidth: 160 }}>{label}</dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card>
      <Stack gap={2}>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase" }}>
          {label}
        </span>
        <strong style={{ fontSize: "var(--text-2xl)", lineHeight: 1 }}>{value}</strong>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{hint}</span>
      </Stack>
    </Card>
  );
}
