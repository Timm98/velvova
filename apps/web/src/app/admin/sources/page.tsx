import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { AlertTriangle, Check, Link2, Lock, X } from "lucide-react";
import { ALL_OPERATIONS, SOURCE_REGISTRY, decideForEntry } from "@paycheck/sources";
import { adapterByKey, cachedHealthCheck, type HealthReport } from "@paycheck/jobs";
import { Badge, Card } from "@/components/ui";
import { PageHeader } from "@/components/ui/states";

export const metadata: Metadata = { title: "Quellen" };
export const dynamic = "force-dynamic";

/**
 * Das Quellenverzeichnis, sichtbar.
 *
 * Hier steht für jede Quelle, was mit ihr geschehen darf — und woran
 * das hängt. Die Tabelle wird nicht gepflegt, sie wird berechnet: sie
 * zeigt exakt die Entscheidungen, die im Abrufpfad gelten. Eine
 * Übersicht, die von der tatsächlichen Regel abweichen kann, wäre
 * schlimmer als keine.
 */

const DECISION_LABEL = {
  approved: { text: "freigegeben", tone: "positive" as const },
  link_only: { text: "nur Verweis", tone: "caution" as const },
  private_import: { text: "privat", tone: "assistant" as const },
  pending_review: { text: "ungeprüft", tone: "outline" as const },
  blocked: { text: "gesperrt", tone: "critical" as const },
};

const HEALTH_LABEL: Record<HealthReport["state"], { text: string; tone: "positive" | "caution" | "critical" | "outline" }> = {
  ok: { text: "antwortet", tone: "positive" },
  degraded: { text: "eingeschränkt", tone: "caution" },
  down: { text: "ausgefallen", tone: "critical" },
  not_configured: { text: "keine Zugangsdaten", tone: "outline" },
  not_allowed: { text: "nicht freigegeben", tone: "outline" },
};

/**
 * Zugang: nur Betrieb.
 *
 * Diese Prüfung fehlte. Die Seite lag im Verzeichnis `admin`, trug den
 * Titel eines Betriebswerkzeugs — und war für jede angemeldete Person
 * erreichbar. Die Geschwisterseiten `/admin` und `/admin/reviews`
 * prüften die Rolle seit jeher; diese beiden nicht.
 *
 * Aufgefallen ist es nicht beim Lesen des Codes, sondern beim Abgehen
 * aller 45 Routen mit einem frisch angelegten, ganz gewöhnlichen Konto:
 * zwei Seiten unter `/admin` antworteten mit 200 statt mit 404.
 *
 * 404 und nicht 403: Ein 403 bestätigt, dass es die Seite gibt.
 */
export default async function AdminSourcesPage() {
  const user = await requireUser();
  const { flags } = await getPageContext();
  if (!flags.adminArea || (user.role !== "operator" && user.role !== "admin")) {
    notFound();
  }

  const now = new Date();
  const rows = SOURCE_REGISTRY.map((entry) => ({
    entry,
    decision: decideForEntry(entry, now),
  })).sort((a, b) => {
    const order = ["approved", "private_import", "link_only", "pending_review", "blocked"];
    return order.indexOf(a.decision.decision) - order.indexOf(b.decision.decision);
  });

  const approved = rows.filter((r) => r.decision.decision === "approved").length;

  /*
   * Der tatsächliche Zustand, nicht der erwartete.
   *
   * Geprüft wird nur, was freigegeben ist — ein Health-Check ist ein
   * Netzzugriff, und ihn vom rechtlichen Riegel auszunehmen wäre genau
   * die Hintertür, die der Riegel schliesst. Deshalb prüft
   * `healthCheck()` die Entscheidung selbst noch einmal. Das Ergebnis
   * gilt eine Minute: ohne Zwischenspeicher wäre jeder Blick auf diese
   * Seite ein Netzzugriff bei jedem Anbieter, und die Betriebsansicht
   * wäre die Ursache des nächsten Ausfalls.
   */
  const health = new Map<string, HealthReport>();
  await Promise.all(
    rows.map(async (r) => {
      const adapter = r.entry.providerKey ? adapterByKey(r.entry.providerKey) : null;
      if (!adapter) return;
      health.set(r.entry.providerKey, await cachedHealthCheck(adapter));
    }),
  );

  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-8 px-5 py-10 md:px-8">
      <PageHeader
        eyebrow="Verwaltung"
        title="Quellenverzeichnis"
        lead={`${approved} von ${rows.length} Quellen sind freigegeben. Was hier nicht freigegeben ist, wird nicht abgerufen, nicht gespeichert und nicht indexiert.`}
      />

      <div
        role="note"
        className="grid gap-2 rounded-(--radius-md) border border-caution/30 bg-caution-soft px-5 py-4"
      >
        <p className="flex items-center gap-2 text-sm font-medium text-caution">
          <AlertTriangle className="size-4" strokeWidth={2} />
          Technische Risikosteuerung, keine Rechtsberatung
        </p>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Diese Tabelle bildet ab, was der Code durchsetzt. Sie ersetzt keine
          anwaltliche Prüfung. Vor einem öffentlichen Betrieb müssen die konkreten
          Verträge, Länder und Datenflüsse von einer auf Datenbank-, Wettbewerbs-,
          Urheber-, Datenschutz- und Plattformrecht spezialisierten Kanzlei geprüft
          werden.
        </p>
      </div>

      <Card padded={false}>
        <div className="scroll-x" tabIndex={0} role="region" aria-label="Quellen">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                {[
                  "Quelle",
                  "Grundlage",
                  "Zugang",
                  "Entscheidung",
                  "Zustand",
                  "Erlaubte Vorgänge",
                  "Volltext",
                  "Cache",
                  "Native Apply",
                  "Geprüft",
                ].map((head) => (
                  <th
                    key={head}
                    className="px-4 py-3 font-mono text-2xs font-medium uppercase tracking-wider text-ink-3"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ entry, decision }) => {
                const label = DECISION_LABEL[decision.decision];
                return (
                  <tr key={entry.providerKey} className="align-top">
                    <td className="px-4 py-4">
                      <span className="block font-medium">{entry.displayName}</span>
                      <span className="block font-mono text-2xs text-ink-3">
                        {entry.providerKey}
                      </span>
                      <span className="mt-1.5 block max-w-[26rem] text-xs leading-relaxed text-ink-3">
                        {entry.note}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-2xs text-ink-2">{entry.legalBasis}</td>
                    <td className="px-4 py-4 font-mono text-2xs text-ink-2">{entry.accessMode}</td>
                    <td className="px-4 py-4">
                      <Badge tone={label.tone}>{label.text}</Badge>
                      {entry.killSwitchReason && (
                        <span className="mt-1.5 block max-w-[16rem] text-xs leading-relaxed text-ink-3">
                          {entry.killSwitchReason}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {/* Was die Quelle gerade TUT, nicht was sie tun dürfte.
                          Eine Entscheidung "freigegeben" neben einem
                          ausgefallenen Dienst ist die Kombination, die man
                          sonst erst beim leeren Ergebnis bemerkt. */}
                      {(() => {
                        const report = health.get(entry.providerKey);
                        if (!report) {
                          return <span className="text-xs text-ink-3">kein Adapter</span>;
                        }
                        const h = HEALTH_LABEL[report.state];
                        return (
                          <>
                            <Badge tone={h.tone}>{h.text}</Badge>
                            <span className="mt-1.5 block max-w-[14rem] text-xs leading-relaxed text-ink-3">
                              {report.detail}
                            </span>
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-4">
                      {decision.allowedOperations.length === 0 ? (
                        <span className="flex items-center gap-1.5 text-xs text-ink-3">
                          <Lock className="size-3" strokeWidth={2} />
                          keine
                        </span>
                      ) : (
                        <ul className="flex flex-wrap gap-1">
                          {ALL_OPERATIONS.filter((op) =>
                            decision.allowedOperations.includes(op),
                          ).map((op) => (
                            <li
                              key={op}
                              className="rounded-(--radius-xs) border border-line-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-2"
                            >
                              {op}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {entry.fullTextAllowed ? (
                        <Check className="size-4 text-positive" strokeWidth={2.2} />
                      ) : (
                        <X className="size-4 text-ink-3" strokeWidth={2.2} />
                      )}
                    </td>
                    <td className="px-4 py-4 font-mono text-2xs text-ink-2">
                      {entry.maxCacheHours === null ? "—" : `${entry.maxCacheHours} h`}
                    </td>
                    <td className="px-4 py-4">
                      {entry.nativeApplyAllowed ? (
                        <Check className="size-4 text-positive" strokeWidth={2.2} />
                      ) : (
                        <X className="size-4 text-ink-3" strokeWidth={2.2} />
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs text-ink-3">
                      {entry.termsCheckedAt ?? "nie"}
                      {entry.termsUrl && (
                        <a
                          href={entry.termsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 flex items-center gap-1 text-accent-text underline underline-offset-[3px]"
                        >
                          <Link2 className="size-3" strokeWidth={1.9} />
                          Bedingungen
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <section aria-labelledby="killswitch" className="grid gap-3">
        <h2 id="killswitch" className="text-lg font-semibold">
          Kill Switch
        </h2>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Jede Quelle lässt sich über <code className="font-mono text-xs">source_registry.enabled</code>{" "}
          abschalten — ohne Auslieferung. Der Abrufpfad prüft die Entscheidung vor
          dem ersten Netzzugriff; eine abgeschaltete Quelle wird nicht mehr
          angefragt und ihre Stellen verschwinden mit dem nächsten Ablauf aus der
          Ansicht.
        </p>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Solange Supabase nicht verbunden ist, gilt die im Code hinterlegte
          Grundausstattung. Sie ist bewusst restriktiv: alles Unbekannte ist
          ungeprüft, nicht erlaubt.
        </p>
      </section>
    </div>
  );
}
