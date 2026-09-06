/**
 * Die Zahlungsarten-Leiste im Fuss.
 *
 * ── Was hier Bild ist und was CSS ─────────────────────────────
 *
 * Die Dateien enthalten ausschliesslich das freigestellte Logo mit
 * echtem Alphakanal. Kasten, Rahmen, Rundung und Innenabstand kommen
 * aus `globals.css`. Die Rohbilder hatten schwarze beziehungsweise
 * blaue Flächen eingebrannt; unverändert eingebaut hätte jedes Logo
 * in einem der beiden Farbschemata einen Fremdkörper um sich.
 * `scripts/zahlungslogos-freistellen.py` erzeugt sie neu.
 *
 * ── Warum zwei Fassungen bei zweien ───────────────────────────
 *
 * AMEX und die Überweisung sind weisse Zeichen. Freigestellt sind sie
 * auf dunklem Grund richtig und auf hellem unsichtbar. Deshalb liegt
 * von beiden eine dunkle Fassung bereit; die Umschaltung macht CSS.
 */

type Zahlungsart = {
  name: string;
  datei: string;
  /** Wahr, wenn eine zweite, dunkle Fassung für helle Flächen existiert. */
  zweifarbig?: boolean;
  /**
   * Eigener Grund statt des einheitlichen Badges.
   *
   * Nur für AMEX: Das Zeichen ist von Haus aus weiss auf blauem
   * Kasten — genau so gibt der Herausgeber es heraus. Auf weissem
   * Grund wäre es unsichtbar, auf schwarzem fremd. Mit eigenem
   * blauem Grund sitzt es in beiden Modi richtig, und die Leiste
   * bekommt zugleich einen Farbpunkt.
   */
  eigenerGrund?: boolean;
};

const ARTEN: Zahlungsart[] = [
  { name: "Visa", datei: "visa" },
  { name: "Mastercard", datei: "mastercard" },
  { name: "American Express", datei: "amex", eigenerGrund: true },
  { name: "PayPal", datei: "paypal" },
  { name: "Überweisung", datei: "ueberweisung", zweifarbig: true },
];

export function Zahlungsarten() {
  return (
    <section aria-labelledby="zahlungsarten" className="grid gap-3">
      <h2 id="zahlungsarten" className="text-sm font-semibold text-ink">
        Zahlungsarten
      </h2>

      <ul className="zahlungsarten list-none p-0">
        {ARTEN.map((a) => (
          <li
            key={a.datei}
            className={a.eigenerGrund ? "zahlungsbadge zahlungsbadge--blau" : "zahlungsbadge"}
          >
            {/*
              Genau ein Logo trägt den Alternativtext, auch wenn zwei
              Bilder im Markup stehen. Sonst läse ein Screenreader
              „Visa Visa" — die zweite Fassung ist eine Darstellungs-
              variante, keine zusätzliche Information.
            */}
            <img
              src={`/zahlungsarten/${a.datei}.png`}
              alt={a.name}
              width={120}
              height={22}
              loading="lazy"
              decoding="async"
              className={a.zweifarbig && !a.eigenerGrund ? "fuer-dunkel" : undefined}
            />
            {a.zweifarbig && !a.eigenerGrund && (
              <img
                src={`/zahlungsarten/${a.datei}-dunkel.png`}
                alt=""
                aria-hidden
                width={120}
                height={22}
                loading="lazy"
                decoding="async"
                className="fuer-hell"
              />
            )}
          </li>
        ))}
      </ul>

      {/*
        Ein Zahlungslogo anzuzeigen heisst zu behaupten, man nehme
        dieses Verfahren an. Es ist noch kein Anbieter angebunden —
        deshalb steht hier, was gilt, statt eine Zusage, die nichts
        einlöst.
      */}
      <p className="max-w-[46ch] text-2xs leading-relaxed text-ink-3">
        Geplante Zahlungsarten. Sobald die Abwicklung eingerichtet ist, steht hier nur noch, was
        tatsächlich angenommen wird.
      </p>
    </section>
  );
}
