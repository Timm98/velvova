import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { nettoAusBrutto } from "@/lib/lebenswert/netto";
import { ladeAktuelleStelle } from "@/lib/lebenswert/speicher";
import {
  stelleAusJob,
  vergleichsdaten,
  type VergleichsStelle,
} from "@/lib/lebenswert/vergleich";
import { ladeGemerkte, ladeStellenFuerVergleich } from "@/lib/lebenswert/vergleich-laden";
import { Vergleichstabelle } from "./Vergleichstabelle";
import { Auswahl } from "./Auswahl";

export const metadata: Metadata = { title: "Stellen vergleichen" };
export const dynamic = "force-dynamic";

/**
 * Zwei Stellen nebeneinander — und die eigene daneben.
 *
 * ── Warum es diese Seite gibt ─────────────────────────────────
 *
 * Die Detailseite beantwortet „passt diese Stelle zu mir?". Die Frage
 * davor lautet aber oft „welche von beiden?", und die lässt sich mit
 * zwei Detailseiten in zwei Tabs nicht beantworten: Man merkt sich das
 * Gehalt der einen, scrollt zur anderen, hat die Wochenstunden
 * vergessen.
 *
 * ── Warum die eigene Stelle mitkommt ──────────────────────────
 *
 * „A oder B?" ist selten die vollständige Frage. Sie lautet fast immer
 * „A, B oder bleiben?". Wer die dritte Möglichkeit nicht sieht,
 * vergleicht zwei Angebote miteinander und übersieht, dass beide
 * schlechter sind als das, was er hat.
 *
 * ── Warum es keine Gesamtnote gibt ────────────────────────────
 *
 * Sie entstünde aus Gewichten, die niemand gewählt hat: Wie viel ist
 * eine Stunde Arbeitsweg gegen zweihundert Euro? Das ist keine
 * Rechenfrage, sondern eine Lebensfrage. Die Tabelle stellt
 * nebeneinander, was messbar ist; gewichtet wird im Kopf des Menschen,
 * der sie liest.
 */
export default async function VergleichPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[] }>;
}) {
  const user = await requireUser();
  const roh = (await searchParams).ids;
  const ids = (Array.isArray(roh) ? roh : (roh ?? "").split(","))
    .map((s) => s.trim())
    .filter(Boolean)
    /*
     * Höchstens drei Stellen.
     *
     * Mit vier Spalten passt auf einem Telefon keine mehr nebeneinander,
     * und eine Tabelle, die man seitlich schieben muss, um zwei Werte
     * zu vergleichen, vergleicht nicht mehr.
     */
    .slice(0, 3);

  const [jobs, gemerkte, eigene] = await Promise.all([
    ladeStellenFuerVergleich(user.id, ids),
    ladeGemerkte(user.id),
    ladeAktuelleStelle(),
  ]);

  /*
   * Netto je Stelle, mit den Steuerangaben der Person.
   *
   * Parallel, weil jede Rechnung die Einstellungen einmal lädt. Bei drei
   * Stellen nacheinander wären das drei Abfragen hintereinander, bevor
   * die Seite überhaupt etwas zeigt.
   */
  const nettos = await Promise.all(
    jobs.map((j) =>
      nettoAusBrutto(
        j.salary.period === "year" ? (j.salary.min ?? j.salary.max) : null,
        j.country || "DE",
      ),
    ),
  );

  const stellen: VergleichsStelle[] = jobs.map((j, i) => stelleAusJob(j, nettos[i]!));

  /*
   * Die eigene Stelle als letzte Spalte.
   *
   * Hinten, nicht vorn: Sie ist der Bezugspunkt, nicht der Vorschlag.
   * Vorn stünde sie wie eine weitere Option zur Auswahl.
   */
  if (eigene && stellen.length > 0) {
    const brutto =
      eigene.salaryPeriod === "year"
        ? eigene.grossAmount
        : eigene.salaryPeriod === "month" && eigene.grossAmount !== null
          ? eigene.grossAmount * 12
          : null;
    const netto = await nettoAusBrutto(brutto, "DE");
    stellen.push({
      id: "eigene",
      titel: eigene.jobTitle || "Deine aktuelle Stelle",
      untertitel: eigene.companyName,
      istEigene: true,
      bruttoVon: brutto,
      bruttoBis: brutto,
      waehrung: eigene.currency,
      nettoMonat: netto.nettoMonat,
      nettoGrund: netto.grund,
      wochenstunden: eigene.weeklyHours,
      pendelMinuten: eigene.commuteMinutes,
      buerotage: eigene.officeDaysPerWeek,
      arbeitsmodell: eigene.workModel,
      vertragsart: null,
      /*
       * Für die eigene Stelle gibt es keinen Anzeigentext.
       *
       * Eine leere Liste ist hier die richtige Auskunft: Wir wissen
       * nicht, welche Leistungen der jetzige Arbeitgeber bietet, und
       * eine Vermutung stünde direkt neben belegten Angaben.
       */
      leistungen: [],
      urlaubstage: null,
    });
  }

  const daten = stellen.length > 0 ? vergleichsdaten(stellen) : null;

  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <Link
          href="/app/jobs"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="size-4" strokeWidth={1.9} />
          Zurück zur Auswahl
        </Link>
        <PageHeader
          eyebrow="Entscheiden"
          title="Stellen vergleichen"
          lead="Nebeneinander, was messbar ist — und deine jetzige Stelle daneben. Gewichtet wird nicht: Wie viel eine Stunde Arbeitsweg gegen zweihundert Euro wiegt, entscheidest du."
        />
      </div>

      <Auswahl gemerkte={gemerkte} ausgewaehlt={ids} zeigtVergleich={daten !== null} />

      {daten ? (
        <Vergleichstabelle daten={daten} />
      ) : (
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Wähle oben zwei oder drei gemerkte Stellen aus. Wenn du in der Lebenshaltung deine
          aktuelle Stelle hinterlegt hast, steht sie automatisch daneben — die Frage lautet selten
          „A oder B", sondern fast immer „A, B oder bleiben".
        </p>
      )}

      {daten && !eigene && (
        <p className="max-w-[var(--measure)] rounded-(--radius-surface) bg-soft p-5 text-sm leading-relaxed text-ink-2">
          Deine aktuelle Stelle fehlt in diesem Vergleich.{" "}
          <Link
            href="/app/settings/lebenshaltung"
            className="text-accent-text underline underline-offset-[3px]"
          >
            Hinterlege sie
          </Link>
          , dann siehst du auch, ob überhaupt einer der beiden Wechsel sich lohnt.
        </p>
      )}
    </div>
  );
}
