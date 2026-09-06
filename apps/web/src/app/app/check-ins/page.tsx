import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { getDb, schema, withUser } from "@paycheck/db";
import { eq } from "drizzle-orm";
import { Badge, Card, EmptyState, PageHeader, Stack } from "@/components/ui";
import { CheckInFormular } from "@/components/checkins/CheckInFormular";
import { faelligeCheckIns } from "@/lib/erinnerungen";
import { and, eq as gleich, inArray } from "drizzle-orm";

export const metadata: Metadata = { title: "Check-ins" };
export const dynamic = "force-dynamic";

/**
 * Der Jobstart-Loop.
 *
 * Wichtig ist der Rahmen: das hier ist keine Ueberwachung. Die Antworten
 * bleiben privat und werden nur auf ausdrückliche Freigabe geteilt. Der
 * Zweck ist, das Versprechen der Anzeige mit der Erfahrung abzugleichen -
 * für den Menschen selbst, nicht für irgendjemanden sonst.
 */
export default async function CheckInsPage() {
  const user = await requireUser();
  const { t } = await getPageContext();
  const db = await getDb();

  const checkIns = await withUser(db, user.id, (tx) =>
    tx.select().from(schema.checkIns).where(eq(schema.checkIns.userId, user.id)),
  );

  /*
   * 30, 90, 180 statt 30, 60, 90.
   *
   * Die alten drei lagen alle in der Probezeit, und dort sagt „ich bin
   * zufrieden" wenig — wer gerade angefangen hat, will die Stelle
   * meistens behalten. Erst nach einem halben Jahr trennt sich, ob eine
   * Empfehlung getaugt hat.
   */
  const marks = [30, 90, 180];

  /*
   * Nur angetretene Stellen. Ein Check-in zu einer Bewerbung, die noch
   * läuft, beantwortet eine Frage, die sich nicht stellt.
   */
  const faellig = await faelligeCheckIns(user.id);

  const laufende = await withUser(db, user.id, (tx) =>
    tx
      .select({
        id: schema.applications.id,
        titel: schema.jobs.title,
        firma: schema.companies.name,
      })
      .from(schema.applications)
      .innerJoin(schema.jobs, gleich(schema.jobs.id, schema.applications.jobId))
      .innerJoin(schema.companies, gleich(schema.companies.id, schema.jobs.companyId))
      .where(
        and(
          gleich(schema.applications.userId, user.id),
          inArray(schema.applications.stage, ["accepted"]),
        ),
      ),
  ).catch(() => []);

  return (
    <Stack gap={6}>
      <PageHeader
        title={t("nav.checkIns")}
        lead="Nach dem Start: hält die Stelle, was die Anzeige versprochen hat?"
      />

      <Card style={{ background: "var(--surface-sunken)", boxShadow: "none" }}>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: "var(--measure)" }}>
          Diese Antworten bleiben privat. Sie werden nicht an Arbeitgeber, nicht an Partner und
          nicht in Auswertungen weitergegeben - es sei denn, du gibst sie ausdrücklich frei.
        </p>
      </Card>

      {checkIns.length === 0 ? (
        <EmptyState
          title={t("states.emptyTitle")}
          body="Check-ins beginnen, sobald du eine Stelle angenommen hast. Dann meldet sich das Produkt nach 30, 60 und 90 Tagen."
        />
      ) : (
        <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-4)" }}>
          {checkIns.map((c) => (
            <Card as="li" key={c.id}>
              <Stack gap={3}>
                <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
                  <Badge tone="accent">Tag {c.dayMark}</Badge>
                  {c.overallFit !== null && (
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                      Passung im Alltag: {c.overallFit} von 10
                    </span>
                  )}
                </div>
                {c.promiseVsReality && (
                  <p style={{ fontSize: "var(--text-sm)" }}>
                    <strong>Anzeige gegen Wirklichkeit:</strong> {c.promiseVsReality}
                  </p>
                )}
                {c.taskEnergy && (
                  <p style={{ fontSize: "var(--text-sm)" }}>
                    <strong>Aufgaben und Energie:</strong> {c.taskEnergy}
                  </p>
                )}
              </Stack>
            </Card>
          ))}
        </ul>
      )}

      {/*
       * Das Formular vor der Erklärung.
       *
       * Hier stand nur, worauf die Check-ins schauen — eine Beschreibung
       * ohne Knopf. `check_ins` wurde von nirgendwo geschrieben, und
       * damit fehlte dem Produkt sein wichtigster Rückkanal.
       */}
      <section aria-labelledby="neuer-checkin" className="grid gap-4">
        <h2 id="neuer-checkin" style={{ fontSize: "var(--text-lg)" }}>
          {faellig.length > 0
            ? `${faellig[0]!.label} — ${faellig[0]!.titel}`
            : laufende.length > 0
              ? "Wie läuft es?"
              : "Noch keine angetretene Stelle"}
        </h2>
        {/*
         * Der fällige Termin steht über dem Formular.
         *
         * Ohne ihn ist „Wie läuft es?" eine Frage ohne Bezug — der
         * Mensch hat womöglich mehrere Stellen im Blick und weiss
         * nicht, welche gemeint ist. Mit Datum und Firma weiss er es.
         */}
        {faellig.length > 0 && (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Fällig seit {new Intl.DateTimeFormat("de-DE").format(faellig[0]!.dueAt)} · {faellig[0]!.firma}
          </p>
        )}
        {laufende.length > 0 ? (
          <CheckInFormular bewerbungen={laufende} />
        ) : (
          <Card>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Sobald du eine Stelle angetreten hast, fragen wir hier nach — nach 30, 90 und 180 Tagen.
              Die Antworten bleiben bei dir.
            </p>
          </Card>
        )}
      </section>

      <section aria-labelledby="fragen">
        <h2 id="fragen" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
          Worauf die Check-ins schauen
        </h2>
        <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
          {marks.map((m) => (
            <Card as="li" key={m}>
              <Stack gap={2}>
                <h3 style={{ fontSize: "var(--text-base)" }}>Nach {m} Tagen</h3>
                <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                  {m === 30 && (
                    <>
                      <li>· Stimmen die Aufgaben mit der Anzeige überein?</li>
                      <li>· Wie war die Einarbeitung?</li>
                      <li>· Was überrascht dich - im Guten wie im Schlechten?</li>
                    </>
                  )}
                  {m === 60 && (
                    <>
                      <li>· Welche Aufgaben geben Energie, welche kosten sie?</li>
                      <li>· Wie läuft es mit Führung und Team?</li>
                      <li>· Was lernst du tatsächlich?</li>
                    </>
                  )}
                  {m === 90 && (
                    <>
                      <li>· Wuerdest du dich noch einmal so entscheiden?</li>
                      <li>· Was solltest du für das Probezeitgespräch vorbereiten?</li>
                      <li>· Was gehört jetzt in dein Profil?</li>
                    </>
                  )}
                </ul>
              </Stack>
            </Card>
          ))}
        </ul>
      </section>
    </Stack>
  );
}
