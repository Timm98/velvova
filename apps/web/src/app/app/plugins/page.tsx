import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/states";

export const metadata: Metadata = { title: "Plugins" };
export const dynamic = "force-dynamic";

/**
 * ══════════════════════════════════════════════════════════════════
 * Plugins — was Monday mit anderen Diensten darf
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Warum diese Seite und nicht /app/settings/integrations ──────
 *
 * Die gibt es, und sie ist etwas anderes: eine Betreiber-Sicht auf
 * Supabase, den KI-Anbieter und den Mailversand, mit den Namen der
 * Umgebungsvariablen daneben. Wer wissen will, ob sein Postfach
 * verbunden ist, findet dort seinen Schlüsselnamen und keine Antwort.
 *
 * Beides zusammenzulegen hiesse, einer Person Infrastruktur zu
 * zeigen, für die sie nichts tun kann.
 *
 * ── Warum hier nichts verbunden ist ─────────────────────────────
 *
 * Weil nichts verbunden IST. Die Tabelle `integrations` existiert
 * samt Zuständen und Arten seit Langem — und kein Code liest oder
 * schreibt sie. Es gibt keinen Verbindungsvorgang, kein Token, keine
 * Rücknahme.
 *
 * Also steht das hier. Ein Knopf „Verbinden", der nichts tut, wäre
 * die schlechtere Antwort: Man drückt ihn, nichts geschieht, und man
 * hält die Anwendung für kaputt statt für unfertig.
 *
 * Die Liste ist trotzdem echt: Sie kommt aus `integration_kind` — den
 * Arten, die das Datenmodell tatsächlich kennt. Keine erfundenen
 * Anbieter, keine Versprechen mit Datum.
 */

/** Die Arten aus `integration_kind`. Wortlaut für Menschen. */
const ARTEN = [
  {
    kind: "email_gmail",
    name: "Gmail",
    zweck: "Bewerbungsantworten erkennen und den Stand automatisch nachführen.",
  },
  {
    kind: "email_outlook",
    name: "Outlook",
    zweck: "Dasselbe für Postfächer bei Microsoft.",
  },
  {
    kind: "storage_s3",
    name: "Eigener Speicher",
    zweck: "Unterlagen in einem eigenen Ablageort halten statt bei Velvova.",
  },
  {
    kind: "job_api",
    name: "Eigene Stellenquelle",
    zweck: "Stellen aus einer eigenen Schnittstelle mitlesen.",
  },
  {
    kind: "review_api",
    name: "Arbeitgeberbewertungen",
    zweck: "Bewertungen zu einem Arbeitgeber mit in die Einschätzung nehmen.",
  },
] as const;

const ZUSTANDSWORT: Record<string, string> = {
  connected: "Verbunden",
  not_connected: "Nicht verbunden",
  error: "Gestört",
  revoked: "Zugriff entzogen",
};

export default async function PluginsPage() {
  const user = await requireUser();

  /*
   * Was tatsächlich in der Tabelle steht.
   *
   * Heute nichts — aber gelesen wird sie trotzdem. Sobald der erste
   * Verbindungsvorgang gebaut ist, zeigt diese Seite ihn ohne
   * Änderung an; und solange nichts drinsteht, behauptet sie auch
   * nichts.
   */
  const vorhanden = await (async () => {
    try {
      const db = await getDb();
      return await withUser(db, user.id, (tx) =>
        tx
          .select({ kind: schema.integrations.kind, status: schema.integrations.status })
          .from(schema.integrations)
          .where(eq(schema.integrations.userId, user.id)),
      );
    } catch {
      return [];
    }
  })();

  const nachArt = new Map(vorhanden.map((v) => [v.kind as string, v.status as string]));

  return (
    <div className="grid gap-8 py-8">
      <PageHeader
        title="Plugins"
        lead="Dienste, die Monday mitlesen oder mitschreiben darf — und was davon heute geht."
      />

      <ul className="grid gap-2">
        {ARTEN.map((a) => {
          const zustand = nachArt.get(a.kind);
          return (
            <li
              key={a.kind}
              className="grid gap-1 rounded-(--radius-lg) border border-(--app-rand) bg-(--app-erhoben) p-4"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[15px] font-medium text-(--app-text)">{a.name}</span>
                {/*
                  Der Zustand kommt aus der Tabelle, wenn eine Zeile da
                  ist. Ist keine da, steht dort NICHT „nicht verbunden"
                  — das klänge nach einem Knopf, den man drücken kann.
                */}
                <span className="text-2xs text-(--app-text-3)">
                  {zustand ? (ZUSTANDSWORT[zustand] ?? zustand) : "Noch nicht verfügbar"}
                </span>
              </div>
              <p className="max-w-[var(--measure)] text-[14px] leading-relaxed text-(--app-text-2)">
                {a.zweck}
              </p>
            </li>
          );
        })}
      </ul>

      <section className="grid gap-2 border-t border-(--app-rand) pt-6">
        <h2 className="text-[15px] font-medium text-(--app-text)">Was heute schon geht</h2>
        <p className="max-w-[var(--measure)] text-[14px] leading-relaxed text-(--app-text-2)">
          Unterlagen kannst du im Gespräch direkt anhängen — Monday liest sie und
          sagt dir, was sie daraus entnommen hat. Und Jobmails bekommst du, sobald
          du sie in den{" "}
          <Link
            href="/app/notifications"
            className="text-(--app-akzent) underline underline-offset-[3px]"
          >
            Benachrichtigungen
          </Link>{" "}
          eingerichtet hast. Beides braucht kein Plugin.
        </p>
      </section>

      <p className="max-w-[var(--measure)] text-[13px] leading-relaxed text-(--app-text-3)">
        Eine Verbindung erlaubt nicht automatisch jede Handlung. Was nach aussen
        geht — eine Mail, eine Bewerbung, ein Termin — bestätigst du weiterhin
        selbst.
      </p>
    </div>
  );
}
