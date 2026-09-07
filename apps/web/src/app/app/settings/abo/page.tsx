import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { zugangFür } from "@/lib/billing/zugang";
import { GRENZEN, PLAENE, preisText } from "@/lib/billing/plaene";
import { GEPLANTE_ZAHLARTEN, ZAHLART_TEXT, zahlungsanbieter } from "@/lib/billing/anbieter";
import { PlanWahl } from "./PlanWahl";

export const metadata: Metadata = { title: "Plan & Abrechnung" };
export const dynamic = "force-dynamic";

/**
 * Plan und Abrechnung.
 *
 * Hier stand vorher „Abo & Zahlung" mit einem Knopf nach `/pricing` —
 * einer eigenen Seite, die aussah wie ein Laden und aus der man mit
 * „Zurück zu Monday" wieder herausfand. Preise sind aber kein Ort, den
 * man besucht, sondern eine Auskunft über das eigene Konto. Deshalb
 * gibt es die Seite nicht mehr; sie leitet hierher.
 *
 * Die Reihenfolge folgt den Fragen, die jemand mit einem Konto hat:
 *
 *   1. Was habe ich gerade, und was kostet es?
 *   2. Wie viel davon nutze ich?
 *   3. Was gäbe es sonst?
 *   4. Womit zahle ich, und was wurde abgebucht?
 *   5. Wie komme ich wieder raus?
 *
 * Die letzte zuerst zu beantworten wäre ungewöhnlich; sie zu verstecken
 * ist üblich und schäbig. Sie steht hier sichtbar am Ende, nicht in
 * einem Untermenü.
 */
export default async function PlanUndAbrechnungPage() {
  const user = await requireUser();
  const zugang = await zugangFür(user.id);
  const anbieter = zahlungsanbieter();
  const db = await getDb();

  const monatsBeginn = new Date();
  monatsBeginn.setDate(1);
  monatsBeginn.setHours(0, 0, 0, 0);

  const [zahlarten, rechnungen, gespeicherteStellen, bewerbungen] = await Promise.all([
    withUser(db, user.id, (tx) =>
      tx.select().from(schema.paymentMethods).where(eq(schema.paymentMethods.userId, user.id)),
    ),
    withUser(db, user.id, (tx) =>
      tx
        .select()
        .from(schema.invoices)
        .where(eq(schema.invoices.userId, user.id))
        .orderBy(desc(schema.invoices.issuedAt))
        .limit(12),
    ),
    withUser(db, user.id, (tx) =>
      tx
        .select({ n: count() })
        .from(schema.savedJobs)
        .where(eq(schema.savedJobs.userId, user.id)),
    ).catch(() => [{ n: 0 }]),
    withUser(db, user.id, (tx) =>
      tx
        .select({ n: count() })
        .from(schema.applications)
        .where(
          and(
            eq(schema.applications.userId, user.id),
            gte(schema.applications.createdAt, monatsBeginn),
          ),
        ),
    ).catch(() => [{ n: 0 }]),
  ]);

  const plan = PLAENE[zugang.plan];
  const grenzen = GRENZEN[zugang.plan];
  const datum = (d: Date) => new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(d);

  /*
   * Was „unbegrenzt" auf dem Bildschirm heisst.
   *
   * `null` bedeutet in den Grenzen „kein Limit". Als Zahl anzuzeigen
   * wäre falsch, als leeres Feld unverständlich — also ein Wort.
   */
  const grenzText = (n: number | null) => (n === null ? "unbegrenzt" : String(n));

  return (
    <div className="grid gap-10">
      {/* ── Dein Plan ───────────────────────────────────────── */}
      <section className="grid gap-5">
        <div className="grid gap-1">
          <span className="abschnitts-titel text-ink-3">Dein Plan</span>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="font-display text-3xl font-normal tracking-[-0.015em]">{plan.name}</h2>
            <p className="text-base text-ink-2">
              {preisText(plan.preisMonatCent)}
              {plan.preisMonatCent > 0 ? " / Monat" : " · dauerhaft"}
            </p>
          </div>
          <p className="max-w-[var(--measure)] pt-1 text-base leading-relaxed text-ink-2">
            {plan.claim}
          </p>
        </div>

        {/* Was als Nächstes passiert — die Auskunft, die nach einer
            Kündigung oder vor einer Abbuchung wirklich fehlt. */}
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {zugang.testphaseEndet && zugang.testphaseEndet.getTime() > Date.now() && (
            <div className="grid gap-0.5">
              <dt className="abschnitts-titel text-ink-3">Testphase</dt>
              <dd className="text-base">endet am {datum(zugang.testphaseEndet)}</dd>
            </div>
          )}

          {zugang.gekuendigtZum ? (
            <div className="grid gap-0.5">
              <dt className="abschnitts-titel text-ink-3">Gekündigt</dt>
              <dd className="text-base">
                aktiv bis {datum(zugang.gekuendigtZum)} — danach Free, es wird nichts weiter
                abgebucht
              </dd>
            </div>
          ) : (
            zugang.zeitraumEnde &&
            zugang.plan !== "free" && (
              <div className="grid gap-0.5">
                <dt className="abschnitts-titel text-ink-3">
                  Nächste Abbuchung
                </dt>
                <dd className="text-base">{datum(zugang.zeitraumEnde)}</dd>
              </div>
            )
          )}

          {zugang.status === "past_due" && (
            <div className="grid gap-0.5">
              <dt className="abschnitts-titel text-caution">Zahlung</dt>
              <dd className="text-base leading-relaxed text-ink-2">
                Die letzte Abbuchung ist nicht durchgegangen. Dein Zugang läuft bis zum Ende des
                bezahlten Zeitraums weiter.
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* ── Nutzung ─────────────────────────────────────────── */}
      <section className="grid gap-4">
        <h2 className="font-display text-xl font-normal tracking-[-0.02em]">Nutzung</h2>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Was dein Plan zulässt. Grenzen stehen hier, damit du sie kennst, bevor du an sie
          stösst — nicht erst, wenn du sie erreicht hast.
        </p>

        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Stellen je Ansicht", grenzText(grenzen.jobsSichtbar)],
            ["Tiefenanalysen im Monat", grenzText(grenzen.tiefenanalysenProMonat)],
            ["Unterlagen im Monat", grenzText(grenzen.dokumenteProMonat)],
            ["Nachrichten an Monday je Tag", grenzText(grenzen.ninaNachrichtenProTag)],
          ].map(([titel, wert]) => (
            <div key={titel} className="grid gap-0.5">
              <dt className="abschnitts-titel text-ink-3">{titel}</dt>
              <dd className="font-display text-xl font-normal">{wert}</dd>
            </div>
          ))}
        </dl>

        <dl className="grid gap-x-8 gap-y-4 border-t border-line-2 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-0.5">
            <dt className="abschnitts-titel text-ink-3">
              Gespeicherte Stellen
            </dt>
            <dd className="font-display text-xl font-normal">
              {gespeicherteStellen[0]?.n ?? 0}
            </dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="abschnitts-titel text-ink-3">
              Bewerbungen diesen Monat
            </dt>
            <dd className="font-display text-xl font-normal">{bewerbungen[0]?.n ?? 0}</dd>
          </div>
          {grenzen.beobachteteStellen > 0 && (
            <div className="grid gap-0.5">
              <dt className="abschnitts-titel text-ink-3">
                Beobachtete Stellen
              </dt>
              <dd className="font-display text-xl font-normal">
                bis {grenzen.beobachteteStellen}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* ── Mehr mit Monday machen ────────────────────────────── */}
      <section className="grid gap-5">
        <div className="grid gap-1">
          <h2 className="font-display text-xl font-normal tracking-[-0.02em]">
            Mehr mit Monday machen
          </h2>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Free bleibt vollständig nutzbar. Die anderen Pläne fügen hinzu, was Monday zusätzlich
            tun kann — sie machen Free nicht schlechter.
          </p>
        </div>

        <PlanWahl
          aktuell={zugang.plan}
          zahlungBereit={anbieter.verfügbar()}
          anbieterName={anbieter.name}
          zahlarten={anbieter.verfügbar() ? anbieter.zahlarten : GEPLANTE_ZAHLARTEN}
        />
      </section>

      {/* ── Zahlungsart ─────────────────────────────────────── */}
      <section className="grid gap-3">
        <h2 className="font-display text-xl font-normal tracking-[-0.02em]">Zahlungsart</h2>
        {zahlarten.length > 0 ? (
          <ul className="grid gap-2">
            {zahlarten.map((z) => (
              <li key={z.id} className="flex items-center justify-between gap-3">
                <span className="text-base">{z.label}</span>
                {z.isDefault && <span className="text-sm text-ink-3">Standard</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="max-w-[var(--measure)] text-base leading-relaxed text-ink-2">
            {anbieter.verfügbar()
              ? "Noch keine Zahlungsart hinterlegt."
              : `Es ist noch kein Zahlungsanbieter verbunden. Vorgesehen sind: ${GEPLANTE_ZAHLARTEN.map((z) => ZAHLART_TEXT[z]).join(", ")}.`}
          </p>
        )}
      </section>

      {/* ── Rechnungen ──────────────────────────────────────── */}
      <section className="grid gap-3">
        <h2 className="font-display text-xl font-normal tracking-[-0.02em]">Rechnungen</h2>
        {rechnungen.length > 0 ? (
          <ul className="grid gap-2">
            {rechnungen.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-base">{datum(r.issuedAt)}</span>
                <span className="flex items-center gap-4">
                  <span className="font-mono text-sm tabular">{preisText(r.amountCents)}</span>
                  {r.pdfUrl && (
                    <a
                      href={r.pdfUrl}
                      className="text-sm text-accent-text underline underline-offset-[3px]"
                    >
                      PDF
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base text-ink-2">Noch keine Rechnungen.</p>
        )}
      </section>

      {/* ── Abo beenden ─────────────────────────────────────── */}
      {zugang.plan !== "free" && !zugang.gekuendigtZum && (
        <section className="grid gap-3 border-t border-line-2 pt-8">
          <h2 className="font-display text-xl font-normal tracking-[-0.02em]">Abo beenden</h2>
          <p className="max-w-[var(--measure)] text-base leading-relaxed text-ink-2">
            Du behältst {plan.name} bis zum Ende des bezahlten Zeitraums. Danach gilt wieder
            Free — dein Profil, deine Gespräche und deine Bewerbungen bleiben vollständig
            erhalten.
          </p>
          <p className="text-base text-ink-2">
            Schreib uns über den{" "}
            <Link href="/contact" className="text-accent-text underline underline-offset-[3px]">
              Kontakt
            </Link>
            , solange die Selbstbedienung noch nicht steht. Wir bestätigen dir die Kündigung
            schriftlich.
          </p>
        </section>
      )}
    </div>
  );
}
