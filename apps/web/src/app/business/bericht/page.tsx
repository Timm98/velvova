import type { Metadata } from "next";
import Link from "next/link";
import { VERAENDERUNGSTEXT, type Veraenderungsart } from "@paycheck/domain";
import { arbeitgeberKontext } from "@/lib/arbeitgeber/zugang";
import { aktivierungLesen, berichteLesen } from "@/lib/arbeitgeber/monatsbericht";
import { Aktivierungsschalter } from "./Aktivierungsschalter";

export const metadata: Metadata = { title: "Monatsbericht" };
export const dynamic = "force-dynamic";

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function monatstext(iso: string): string {
  const [jahr, monat] = iso.split("-");
  return `${MONATE[Number(monat) - 1] ?? monat} ${jahr}`;
}

/**
 * Der Monatsbericht.
 *
 * ── Warum die Seite auch ohne Bericht etwas sagt ────────────────
 *
 * Weil „noch nichts da" mehrere Gründe haben kann: nicht
 * eingeschaltet, eingeschaltet aber noch kein Monat vergangen, oder
 * ein Lauf, der abgebrochen ist. Eine leere Seite lässt den Betrieb
 * raten, welcher der drei Fälle vorliegt.
 *
 * ── Warum „kein belastbarer neuer Stand" gross dasteht ──────────
 *
 * Weil es das häufigste ehrliche Ergebnis ist und in den meisten
 * Produkten das einzige, das nie erscheint. Ein Bericht, der jeden
 * Monat etwas finden muss, findet jeden Monat etwas.
 */
export default async function BerichtPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org } = await searchParams;
  const { organisation, user } = await arbeitgeberKontext(org);
  const [aktivierung, berichte] = await Promise.all([
    aktivierungLesen(organisation.organizationId),
    berichteLesen(organisation.organizationId),
  ]);

  const darfSchalten = organisation.rolle === "owner" || organisation.rolle === "admin";
  void user;

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-2xl font-normal tracking-[-0.02em]">Monatsbericht</h1>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Einmal im Monat ein Vergleich: Was ist neu, was hat sich verändert, was bleibt offen. Kein
          täglicher Alarm — und in einem Monat ohne belastbare Neuigkeit steht genau das da.
        </p>
      </div>

      <Aktivierungsschalter
        orgId={organisation.organizationId}
        aktiv={aktivierung.aktiv}
        zustaendig={aktivierung.zustaendig}
        darfSchalten={darfSchalten}
      />

      {berichte.length === 0 ? (
        <section className="grid gap-2 rounded-(--radius-lg) border border-line bg-raised p-5">
          <h2 className="text-[15px] font-semibold text-ink">Noch kein Bericht</h2>
          <p className="max-w-[var(--measure)] text-[14.5px] leading-relaxed text-ink-2">
            {aktivierung.aktiv
              ? "Eingeschaltet. Der erste Bericht entsteht, sobald ein vollständiger Monat vergangen ist — berichtet wird immer über den letzten abgeschlossenen Monat, nicht über den laufenden."
              : "Der Bericht ist nicht eingeschaltet. Solange er aus ist, entsteht keiner und wird auch keiner verschickt."}
          </p>
          <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
            Verglichen werden Ihre <Link href="/business/vorgaenge" className="underline underline-offset-2">Klärungen</Link>.
            Ohne eine gibt es nichts zu vergleichen.
          </p>
        </section>
      ) : (
        <ul className="grid gap-4">
          {berichte.map((b) => (
            <li key={b.id} className="grid gap-3 rounded-(--radius-lg) border border-line bg-raised p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[16px] font-semibold text-ink">{monatstext(b.berichtsmonat)}</h2>
                <span className="text-2xs text-ink-3">
                  {b.zustand === "fertig"
                    ? b.fertigAm?.toLocaleDateString("de-DE")
                    : b.zustand === "laeuft"
                      ? "wird gerechnet"
                      : "abgebrochen"}
                </span>
              </div>

              {b.zustand === "abgebrochen" && (
                <p className="max-w-[var(--measure)] text-[14.5px] leading-relaxed text-caution">
                  Dieser Lauf ist abgebrochen. Er wird beim nächsten Anlauf wiederholt.
                  {b.fehler ? ` Grund: ${b.fehler}` : ""}
                </p>
              )}

              {b.lage === "kein_neuer_stand" ? (
                <p className="max-w-[var(--measure)] text-[14.5px] leading-relaxed text-ink-2">
                  Kein belastbarer neuer Stand. {b.grund}
                </p>
              ) : (
                <ul className="grid gap-2">
                  {b.veraenderungen.slice(0, 3).map((v) => (
                    <li key={v.schluessel} className="grid gap-0.5">
                      <span className="text-[14.5px] text-ink">{v.titel}</span>
                      <span className="text-2xs leading-relaxed text-ink-3">
                        {VERAENDERUNGSTEXT[v.art as Veraenderungsart] ?? v.art}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="grid gap-2 border-t border-line pt-6">
        <h2 className="text-[15px] font-semibold text-ink">Was der Bericht nicht kann</h2>
        <ul className="grid gap-1.5 text-[14px] leading-relaxed text-ink-2">
          <li>
            · Er behauptet nie, dass ein Thema gelöst ist, weil es verschwunden ist. Fehlende Daten
            sind keine Verbesserung.
          </li>
          <li>
            · Er rechnet keine Wirkung in Prozent. Ein Vorher-Nachher ist kein Nachweis einer
            Ursache.
          </li>
          <li>
            · Ändert sich der betrachtete Ausschnitt, ist der Vergleich mit dem Vormonat ausgesetzt
            und wird als solcher benannt.
          </li>
          <li>
            · Passende Menschen zu einem bestätigten Bedarf sucht er noch nicht — das ist gebaut für
            Angebote, nicht für Klärungen.
          </li>
        </ul>
      </section>
    </div>
  );
}
