"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { PLAENE, preisText } from "@/lib/billing/plaene";
import { ZAHLART_TEXT, type Zahlart } from "@/lib/billing/anbieter";
import { cn } from "@/lib/cn";

/**
 * Free neben Premium.
 *
 * Zwei Spalten, keine Merkmalstabelle mit dreissig Häkchen. Eine solche
 * Tabelle beantwortet die Frage „was kann ich?" nicht besser — sie
 * verschiebt sie nur ins Kleingedruckte.
 *
 * Der Jahrespreis wird als Monatspreis gezeigt und der Rabatt daneben
 * ausgerechnet. „25 % sparen" ohne Zahl ist eine Behauptung; 12 € gegen
 * 9 € ist eine Auskunft.
 */
export function PreisTafel({
  angemeldet,
  zahlartenVerfügbar,
  geplanteZahlarten,
}: {
  angemeldet: boolean;
  zahlartenVerfügbar: boolean;
  geplanteZahlarten: Zahlart[];
}) {
  const [jährlich, setJährlich] = useState(true);
  const premium = PLAENE.premium;
  const preis = jährlich ? premium.preisJahrProMonatCent : premium.preisMonatCent;
  const rabatt = Math.round(
    100 - (premium.preisJahrProMonatCent / premium.preisMonatCent) * 100,
  );

  return (
    <div className="grid gap-10">
      {/* ── Umschaltung ─────────────────────────────────────── */}
      <div className="flex justify-center">
        <div
          role="radiogroup"
          aria-label="Abrechnungszeitraum"
          className="inline-flex items-center gap-1 rounded-(--radius-pill) bg-soft p-1"
        >
          {[
            { wert: false, text: "Monatlich" },
            { wert: true, text: `Jährlich · ${rabatt} % weniger` },
          ].map((o) => (
            <button
              key={String(o.wert)}
              type="button"
              role="radio"
              aria-checked={jährlich === o.wert}
              onClick={() => setJährlich(o.wert)}
              className={cn(
                "h-10 rounded-(--radius-pill) px-5 text-sm transition-colors",
                jährlich === o.wert ? "bg-raised font-medium shadow-sm" : "text-ink-2",
              )}
            >
              {o.text}
            </button>
          ))}
        </div>
      </div>

      {/* ── Die zwei Pläne ──────────────────────────────────── */}
      <div className="grid gap-5 md:grid-cols-[repeat(2,minmax(0,1fr))]">
        {(["free", "premium"] as const).map((key) => {
          const plan = PLAENE[key];
          const istPremium = key === "premium";
          return (
            <section
              key={key}
              className={cn(
                "grid gap-5 rounded-(--radius-xl) px-7 py-8",
                istPremium ? "bg-lavender" : "bg-soft",
              )}
            >
              <div className="grid gap-2">
                <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">
                  {plan.name}
                </h2>
                <p className="max-w-[34ch] text-base leading-relaxed text-ink-2">{plan.claim}</p>
              </div>

              <p className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-semibold tracking-[-0.03em]">
                  {istPremium ? preisText(preis) : "0 €"}
                </span>
                <span className="text-sm text-ink-3">
                  {istPremium ? "pro Monat" : "dauerhaft"}
                </span>
              </p>

              <ul className="grid gap-2.5">
                {plan.enthalten.map((z) => (
                  <li key={z} className="flex items-start gap-2.5">
                    <Check
                      className={cn(
                        "mt-1 size-4 shrink-0",
                        istPremium ? "text-accent" : "text-positive",
                      )}
                      strokeWidth={2.2}
                    />
                    <span className="min-w-0 text-base leading-relaxed">{z}</span>
                  </li>
                ))}
              </ul>

              {istPremium ? (
                zahlartenVerfügbar ? (
                  <Link
                    href={angemeldet ? "/app/settings/abo" : "/register"}
                    className="inline-flex h-12 w-fit items-center rounded-(--radius-pill) bg-accent px-6 text-base font-medium text-accent-on transition-colors hover:bg-accent-hover"
                  >
                    Premium freischalten
                  </Link>
                ) : (
                  /*
                   * Kein Knopf ins Leere.
                   *
                   * Solange kein Zahlungsanbieter eingerichtet ist,
                   * steht hier, wie es ist. Ein „Jetzt kaufen", das
                   * nichts kauft, wäre eine Attrappe im
                   * Produktionspfad.
                   */
                  <p className="rounded-(--radius-lg) bg-raised px-5 py-4 text-base leading-relaxed text-ink-2">
                    Die Zahlung ist noch nicht freigeschaltet. Sobald sie steht, kannst du
                    Premium hier buchen — vorher nehmen wir kein Geld entgegen.
                  </p>
                )
              ) : (
                <Link
                  href={angemeldet ? "/app" : "/register"}
                  className="inline-flex h-12 w-fit items-center rounded-(--radius-pill) bg-raised px-6 text-base font-medium transition-colors hover:bg-soft-hover"
                >
                  {angemeldet ? "Zu deinem Konto" : "Kostenlos starten"}
                </Link>
              )}
            </section>
          );
        })}
      </div>

      {/* ── Zahlarten ───────────────────────────────────────── */}
      <div className="grid gap-2 text-center">
        <p className="text-sm text-ink-3">
          {zahlartenVerfügbar ? "Zahlbar mit" : "Vorgesehene Zahlarten"}
        </p>
        <p className="text-base text-ink-2">
          {geplanteZahlarten.map((z) => ZAHLART_TEXT[z]).join(" · ")}
        </p>
      </div>
    </div>
  );
}
