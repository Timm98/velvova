import Link from "next/link";
import { PLAENE, PLAN_REIHENFOLGE, preisText } from "@/lib/billing/plaene";

/**
 * Die drei Pläne auf der Startseite.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum diese Zahlen hier stehen dürfen
 * ══════════════════════════════════════════════════════════════
 *
 * Weil sie nicht für diese Seite erfunden wurden. `PLAENE` ist
 * dieselbe Quelle, aus der die Planauswahl unter Profil →
 * Einstellungen liest; 0, 9 und 19 Euro stehen dort seit jeher und
 * gelten bereits im Produkt.
 *
 * Der Unterschied zu vorher ist deshalb kein neuer Preis, sondern
 * seine Sichtbarkeit: Sie standen hinter der Anmeldung. Wer wissen
 * wollte, was Velvova kostet, musste ein Konto anlegen — genau die
 * Frage, die man vorher beantwortet haben will.
 *
 * ══════════════════════════════════════════════════════════════
 * Und was hier bewusst NICHT steht
 * ══════════════════════════════════════════════════════════════
 *
 * Keine durchgestrichenen Preise, kein „nur noch heute", keine
 * Jahresrabatte, die es nicht gibt. Keine Zusage über künftige
 * Konditionen: Was hier steht, gilt heute.
 *
 * Und keine fünfzehn Punkte je Karte. `hauptvorteile` sind fünf, aus
 * demselben Grund, aus dem sie es in der Planauswahl sind: Eine Liste,
 * die scrollt, wird nicht gelesen, sondern überflogen — und erzeugt
 * das Gefühl, etwas zu übersehen.
 */
export function Abomodell({ angemeldet }: { angemeldet: boolean }) {
  return (
    <section
      aria-labelledby="plaene"
      className="mx-auto w-full max-w-[1240px] px-5 py-20 md:px-8 md:py-24"
    >
      <div className="grid gap-3">
        <h2
          id="plaene"
          className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-normal leading-tight tracking-[-0.02em]"
        >
          Was Velvova kostet
        </h2>
        <p className="max-w-[52ch] text-[15px] leading-relaxed text-ink-2">
          Der Einstieg ist dauerhaft kostenlos. Bezahlt wird für laufende Begleitung, nicht für den
          Zugang zu einer Antwort.
        </p>
      </div>

      <ul className="mt-10 grid gap-4 md:grid-cols-3">
        {PLAN_REIHENFOLGE.map((key) => {
          const plan = PLAENE[key];
          /*
           * Nur Premium wird hervorgehoben, und zwar durch den Rand,
           * nicht durch eine Fläche. Eine eingefärbte Karte zieht den
           * Blick so stark, dass die beiden anderen wie Restposten
           * wirken — Free ist aber ein vollwertiger Plan und für viele
           * der richtige.
           */
          const betont = key === "premium";
          return (
            <li
              key={key}
              className={[
                "grid content-start gap-5 rounded-(--radius-lg) border p-6",
                betont ? "border-accent" : "border-line",
              ].join(" ")}
              style={{ background: "var(--ed-surface)" }}
            >
              <div className="grid gap-1">
                <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-3">
                  {plan.label}
                </p>
                <h3 className="font-display text-xl font-medium">{plan.name}</h3>
              </div>

              <p className="flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-semibold tabular-nums">
                  {preisText(plan.preisMonatCent)}
                </span>
                <span className="text-sm text-ink-2">
                  {plan.preisMonatCent === 0 ? "für immer" : "im Monat"}
                </span>
              </p>

              <p className="text-[15px] leading-relaxed text-ink-2">{plan.claim}</p>

              <ul className="grid gap-2 border-t border-line pt-5">
                {plan.hauptvorteile.map((v) => (
                  <li key={v} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-2">
                    {/*
                      Ein Strich, kein Häkchen.

                      Ein grünes Häkchen sagt „erledigt" oder „geprüft".
                      Hier steht aber, was enthalten ist — eine Aufzählung,
                      keine Bestätigung.
                    */}
                    <span aria-hidden className="mt-2.5 h-px w-2.5 shrink-0 bg-ink-3" />
                    {v}
                  </li>
                ))}
              </ul>

              <Link
                href={angemeldet ? "/app/settings/abo" : "/register"}
                className={[
                  "flex h-11 items-center justify-center rounded-(--radius-control) text-sm font-medium transition-colors duration-(--duration-fast)",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  betont
                    ? "bg-accent text-white hover:opacity-90"
                    : "border border-line text-ink hover:border-accent",
                ].join(" ")}
              >
                {angemeldet ? "Plan ansehen" : plan.preisMonatCent === 0 ? "Kostenlos starten" : `${plan.name} wählen`}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 max-w-[60ch] text-2xs leading-relaxed text-ink-3">
        Preise pro Person und Monat, inklusive Mehrwertsteuer. Monatlich kündbar. Der vollständige
        Umfang aller Pläne steht in den Einstellungen unter „Plan &amp; Abrechnung".
      </p>
    </section>
  );
}
