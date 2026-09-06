import Link from "next/link";
import type { Job } from "@paycheck/domain";
import { leistungenAusText } from "@paycheck/jobs/leistungen";
import { nettoAusBrutto } from "@/lib/lebenswert/netto";
import { ladeAktuelleStelle } from "@/lib/lebenswert/speicher";
import { arbeitswegBerechnen } from "@/lib/geo/arbeitsweg";
import { WOCHEN_JE_MONAT } from "@/lib/lebenswert/pendelzeit";

/**
 * Was der Job für den Alltag bedeutet — in Dimensionen, nicht als Note.
 *
 * ── Warum kein Prozentwert ────────────────────────────────────
 *
 * „Life Fit: 87 %" wäre die bequemste Darstellung und die
 * unehrlichste. Die Zahl entstünde aus Gewichten, die niemand gewählt
 * hat: Wie viel wiegt eine Stunde Arbeitsweg gegen zweihundert Euro?
 * Das ist keine Rechenfrage, sondern eine Lebensfrage.
 *
 * Also die Posten einzeln, mit Vorzeichen, und die Abwägung bleibt bei
 * der Person.
 *
 * ── Warum nichts dasteht, wenn nichts bekannt ist ─────────────
 *
 * Jeder Posten braucht zwei Seiten: die neue Stelle UND die jetzige.
 * Ohne die jetzige gibt es keinen Unterschied, sondern nur eine Zahl —
 * und die steht schon weiter oben.
 */
export async function LifeFitBlock({
  job,
  wohnort,
}: {
  job: Pick<Job, "salary" | "country" | "workModel" | "location" | "description" | "weeklyHours" | "latitude" | "longitude">;
  wohnort: string | null;
}) {
  const stelle = await ladeAktuelleStelle();

  if (!stelle || stelle.grossAmount === null) {
    return (
      <div className="grid gap-2">
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Wenn du deine aktuelle Stelle hinterlegst, zeige ich dir hier, was sich durch einen
          Wechsel tatsächlich ändert — beim Geld, bei der Zeit und beim Arbeitsmodell.
        </p>
        <Link
          href="/app/settings/lebenshaltung"
          className="w-fit text-sm text-accent-text underline underline-offset-[3px]"
        >
          Aktuelle Stelle hinterlegen
        </Link>
      </div>
    );
  }

  const posten: { text: string; richtung: "plus" | "minus" | "neutral" }[] = [];

  /* ── Geld ─────────────────────────────────────────────── */
  const neuBrutto =
    job.salary.period === "year" ? (job.salary.min ?? job.salary.max) : null;
  const altBrutto =
    stelle.salaryPeriod === "year"
      ? stelle.grossAmount
      : stelle.salaryPeriod === "month"
        ? stelle.grossAmount * 12
        : null;

  if (neuBrutto !== null && altBrutto !== null) {
    const [neu, alt] = await Promise.all([
      nettoAusBrutto(neuBrutto, job.country || "DE"),
      nettoAusBrutto(altBrutto, "DE"),
    ]);
    if (neu.nettoMonat !== null && alt.nettoMonat !== null) {
      const d = neu.nettoMonat - alt.nettoMonat;
      posten.push({
        text: `${d >= 0 ? "+" : "−"} ca. ${Math.abs(d).toLocaleString("de-DE")} € netto im Monat`,
        richtung: d > 0 ? "plus" : d < 0 ? "minus" : "neutral",
      });
    }
  }

  /* ── Arbeitsmodell ────────────────────────────────────── */
  if (job.workModel && stelle.workModel && job.workModel !== stelle.workModel) {
    const wort: Record<string, string> = {
      remote: "vollständig remote",
      hybrid: "hybrid",
      on_site: "vor Ort",
    };
    const besser =
      (job.workModel === "remote" && stelle.workModel !== "remote") ||
      (job.workModel === "hybrid" && stelle.workModel === "on_site");
    posten.push({
      text: `${besser ? "+" : "−"} ${wort[job.workModel] ?? job.workModel} statt ${wort[stelle.workModel] ?? stelle.workModel}`,
      richtung: besser ? "plus" : "minus",
    });
  }

  /* ── Arbeitsweg ───────────────────────────────────────── */
  const weg = await arbeitswegBerechnen(wohnort, job.location, job.country, {
    lat: job.latitude,
    lon: job.longitude,
  });
  const auto = weg.strecken.find((s) => s.modus === "auto");
  if (auto && stelle.officeDaysPerWeek !== null && stelle.commuteMinutes !== null) {
    const neuStunden = (auto.minuten * 2 * stelle.officeDaysPerWeek * WOCHEN_JE_MONAT) / 60;
    const altStunden =
      (stelle.commuteMinutes * 2 * stelle.officeDaysPerWeek * WOCHEN_JE_MONAT) / 60;
    const d = Math.round(neuStunden - altStunden);
    if (d !== 0) {
      posten.push({
        text: `${d > 0 ? "−" : "+"} ${Math.abs(d)} Std. Pendeln im Monat`,
        richtung: d > 0 ? "minus" : "plus",
      });
    }
  }

  /* ── Wochenstunden ────────────────────────────────────── */
  if (job.weeklyHours !== null && stelle.weeklyHours !== null && job.weeklyHours !== stelle.weeklyHours) {
    const d = job.weeklyHours - stelle.weeklyHours;
    posten.push({
      text: `${d > 0 ? "−" : "+"} ${Math.abs(d)} Std. Arbeitszeit pro Woche`,
      richtung: d > 0 ? "minus" : "plus",
    });
  }

  /* ── Leistungen ───────────────────────────────────────── */
  const leistungen = leistungenAusText(job.description);
  const urlaub = leistungen.find((l) => l.art === "urlaub")?.wert;
  if (urlaub) posten.push({ text: `${urlaub} Urlaubstage genannt`, richtung: "neutral" });
  const homeoffice = leistungen.some((l) => l.art === "homeoffice");
  if (homeoffice && job.workModel !== "remote") {
    posten.push({ text: "Homeoffice in der Anzeige genannt", richtung: "plus" });
  }

  if (posten.length === 0) {
    return (
      <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
        Für einen Vergleich mit deiner jetzigen Stelle fehlen noch Angaben — bei dieser Anzeige,
        bei dir, oder bei beiden.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {posten.map((p) => (
          <li key={p.text} className="flex items-start gap-2.5 text-[15px] leading-relaxed">
            <span
              aria-hidden
              className={
                "mt-[9px] block size-1.5 shrink-0 rounded-full " +
                (p.richtung === "plus"
                  ? "bg-positive"
                  : p.richtung === "minus"
                    ? "bg-caution"
                    : "bg-line-2")
              }
            />
            <span className={p.richtung === "neutral" ? "text-ink-2" : "text-ink"}>{p.text}</span>
          </li>
        ))}
      </ul>
      <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
        Gegenüber deiner hinterlegten Stelle. Keine Gesamtnote — wie viel eine Stunde Arbeitsweg
        gegen zweihundert Euro wiegt, entscheidest du.
      </p>
    </div>
  );
}
