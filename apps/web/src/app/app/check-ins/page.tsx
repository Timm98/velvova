import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { getDb, schema, withUser } from "@paycheck/db";
import { eq } from "drizzle-orm";
import { Badge, Card, EmptyState, PageHeader, Stack } from "@/components/ui";
import { CheckInFormular } from "@/components/checkins/CheckInFormular";
import { faelligeCheckIns } from "@/lib/erinnerungen";
import { MARKEN, markeText } from "@paycheck/domain";
import { and, eq as gleich, inArray } from "drizzle-orm";

export const metadata: Metadata = { title: "Check-ins" };
export const dynamic = "force-dynamic";

/** Was zu jeder Marke gefragt wird — dieselbe Reihe wie im Formular. */
const WORAUF: Record<number, string[]> = {
  30: [
    "Stimmen die Aufgaben mit der Anzeige überein?",
    "Wie war die Einarbeitung?",
    "Was überrascht dich — im Guten wie im Schlechten?",
  ],
  90: [
    "Würdest du dich noch einmal so entscheiden?",
    "Welche Aufgaben geben Energie, welche kosten sie?",
    "Was gehört jetzt in dein Profil?",
  ],
  365: [
    "Ist es das geblieben, was es am Anfang war?",
    "Was hat sich verändert — an der Arbeit oder an dir?",
    "Stimmt das Gehalt noch zum Markt?",
  ],
  1095: [
    "War der Wechsel rückblickend richtig?",
    "Was hat er dir gebracht, was du vorher nicht hattest?",
    "Wohin geht der nächste Schritt?",
  ],
};

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
   * Welche Stellen schon einen Wechselkontext haben.
   *
   * Die Frage nach Wechselgrund, Berufsnähe und Ausbildungspassung
   * gehört nicht in jeden Check-in — sie ändert sich nach dem Antritt
   * nicht mehr, und der Grund kann eine Kündigung sein. Das Formular
   * blendet den Block aus, sobald zu dieser Stelle etwas steht.
   */
  const mitKontext = new Set(
    checkIns
      .filter((c) => c.wechselgrund ?? c.berufsnaehe ?? c.ausbildungspassung)
      .map((c) => c.applicationId)
      .filter((id): id is string => id !== null),
  );

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
          body="Check-ins beginnen, sobald du eine Stelle angenommen hast. Danach meldet sich Velvova nach 30 Tagen, 3 Monaten, einem Jahr und drei Jahren."
        />
      ) : (
        <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-4)" }}>
          {checkIns.map((c) => (
            <Card as="li" key={c.id}>
              <Stack gap={3}>
                <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
                  <Badge tone="accent">Nach {markeText(c.dayMark)}</Badge>
                  {c.overallFit !== null && (
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                      {/*
                        Von 5, nicht von 10.
                        Das Formular fragt auf einer fünfstufigen Skala
                        („gar nicht" bis „sehr gut"), und `overallFit`
                        wird beim Schreiben auf 1..5 begrenzt. Hier stand
                        „von 10" — dieselbe Zahl, doppelt so schlecht
                        gelesen.
                      */}
                      Passung im Alltag: {c.overallFit} von 5
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
          <CheckInFormular
            bewerbungen={laufende.map((b) => ({ ...b, kontextFehlt: !mitKontext.has(b.id) }))}
          />
        ) : (
          <Card>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Sobald du eine Stelle angetreten hast, fragen wir hier nach — nach 30 Tagen, 3 Monaten,
              einem Jahr und drei Jahren. Die Antworten bleiben bei dir.
            </p>
          </Card>
        )}
      </section>

      {/*
       * Warum gerade diese vier Zeitpunkte.
       *
       * Hier standen drei Karten mit den Fragen zu 30, 60 und 90 Tagen,
       * während die Marken daneben 30, 90 und 180 waren — die dritte
       * Karte blieb deshalb leer. Beides kommt jetzt aus derselben
       * Quelle wie die Erinnerungen.
       */}
      <section aria-labelledby="fragen">
        <h2 id="fragen" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
          Worauf die Check-ins schauen
        </h2>
        <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
          {MARKEN.map((m) => (
            <Card as="li" key={m}>
              <Stack gap={2}>
                <h3 style={{ fontSize: "var(--text-base)" }}>Nach {markeText(m)}</h3>
                <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                  {(WORAUF[m] ?? []).map((frage) => (
                    <li key={frage}>· {frage}</li>
                  ))}
                </ul>
              </Stack>
            </Card>
          ))}
        </ul>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.6, marginTop: "var(--space-4)", maxWidth: "var(--measure)" }}>
          Die letzten beiden Termine liegen weit voraus, und das ist der Punkt: Wer den Arbeitgeber
          wechselt, ist danach erst einmal zufriedener — auch dann, wenn die Stelle nicht besser
          ist. Wer nur die ersten Monate misst, misst diesen Anstieg. Ob ein Wechsel getragen hat,
          zeigt sich nach einem Jahr und nach drei.
        </p>
      </section>
    </Stack>
  );
}
