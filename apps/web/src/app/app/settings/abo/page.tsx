import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { zugangFür } from "@/lib/billing/zugang";
import { PLAENE, preisText } from "@/lib/billing/plaene";
import { GEPLANTE_ZAHLARTEN, ZAHLART_TEXT, zahlungsanbieter } from "@/lib/billing/anbieter";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Abo & Zahlung" };
export const dynamic = "force-dynamic";

/**
 * Der Abo-Bereich.
 *
 * Vier Fragen, die jemand mit einem Abo hat, und zwar in dieser
 * Reihenfolge: Was habe ich? Was kostet es? Womit zahle ich? Wie komme
 * ich wieder raus?
 *
 * Die letzte zuerst zu beantworten wäre ungewöhnlich; sie zu verstecken
 * ist üblich und schäbig. Sie steht hier sichtbar am Ende, nicht in
 * einem Untermenü.
 */
export default async function AboPage() {
  const user = await requireUser();
  const [zugang, anbieter] = await Promise.all([zugangFür(user.id), zahlungsanbieter()]);
  const db = await getDb();

  const [zahlarten, rechnungen] = await Promise.all([
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
  ]);

  const plan = PLAENE[zugang.plan];

  return (
    <div className="grid gap-6">
      {/* ── Aktueller Plan ──────────────────────────────────── */}
      <Card className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">Dein Plan</h2>
          <span className="rounded-(--radius-pill) bg-lavender px-3.5 py-1 text-sm font-medium">
            {plan.name}
          </span>
        </div>
        <p className="max-w-[var(--measure)] text-base leading-relaxed text-ink-2">{plan.claim}</p>

        {zugang.laeuftAus && (
          /*
           * Gekündigt, aber noch bezahlt. Der Unterschied zwischen
           * „sofort weg" und „bis zum Ende des Zeitraums" ist genau
           * die Auskunft, die jemand nach einer Kündigung braucht.
           */
          <p className="rounded-(--radius-lg) bg-caution-soft px-5 py-4 text-base leading-relaxed text-ink-2">
            Gekündigt. Premium bleibt bis zum{" "}
            {new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(zugang.laeuftAus)}{" "}
            aktiv, danach gilt wieder Free. Es wird nichts weiter abgebucht.
          </p>
        )}

        {zugang.plan === "free" && (
          <p>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center rounded-(--radius-pill) bg-accent px-5 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover"
            >
              Premium ansehen
            </Link>
          </p>
        )}
      </Card>

      {/* ── Zahlungsart ─────────────────────────────────────── */}
      <Card className="grid gap-3">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">Zahlungsart</h2>
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
      </Card>

      {/* ── Rechnungen ──────────────────────────────────────── */}
      <Card className="grid gap-3">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">Rechnungen</h2>
        {rechnungen.length > 0 ? (
          <ul className="grid gap-2">
            {rechnungen.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-base">
                  {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(r.issuedAt)}
                </span>
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
      </Card>

      {/* ── Kündigen ────────────────────────────────────────── */}
      {zugang.plan === "premium" && !zugang.laeuftAus && (
        <Card className="grid gap-3">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">Kündigen</h2>
          <p className="max-w-[var(--measure)] text-base leading-relaxed text-ink-2">
            Du behältst Premium bis zum Ende des bezahlten Zeitraums. Danach gilt wieder Free —
            deine Daten, dein Profil und deine Bewerbungen bleiben erhalten.
          </p>
          <p className="text-base text-ink-2">
            Schreib uns über den{" "}
            <Link href="/contact" className="text-accent-text underline underline-offset-[3px]">
              Kontakt
            </Link>
            , solange die Selbstbedienung noch nicht steht. Wir bestätigen dir die Kündigung
            schriftlich.
          </p>
        </Card>
      )}
    </div>
  );
}
