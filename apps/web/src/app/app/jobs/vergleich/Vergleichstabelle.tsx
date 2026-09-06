import { Check } from "lucide-react";
import { beste, type Vergleichsdaten } from "@/lib/lebenswert/vergleich";

/**
 * Die Tabelle.
 *
 * ── Warum eine echte Tabelle ──────────────────────────────────
 *
 * Mit `<table>`, `<th scope>` und Zeilenköpfen — nicht mit
 * verschachtelten Divs. Ein Screenreader liest hier „Netto im Monat,
 * Stelle B, 3.200 €"; in einem Raster aus Divs liest er
 * „3.200 €" ohne jede Zuordnung. Genau bei einem Vergleich ist die
 * Zuordnung die ganze Information.
 *
 * ── Warum das Häkchen und keine Farbe ─────────────────────────
 *
 * Grün und Rot wären schneller zu erfassen und für rund acht Prozent
 * der Männer nicht unterscheidbar. Das Häkchen trägt zusätzlich einen
 * Text für Screenreader — die Auszeichnung hängt damit nicht an der
 * Farbe allein.
 *
 * ── Warum Lücken grau und ausgeschrieben sind ─────────────────
 *
 * Ein leeres Feld liest sich wie eine Null. „nicht angegeben" liest
 * sich wie das, was es ist.
 */
export function Vergleichstabelle({ daten }: { daten: Vergleichsdaten }) {
  const beteBySchluessel = new Map(daten.zeilen.map((z) => [z.key, beste(z)]));

  return (
    /*
     * Seitlich scrollbar, aber nur die Tabelle.
     *
     * Bei drei Spalten auf einem 360-Pixel-Gerät geht es nicht anders.
     * Der Seitenkörper darf dabei nicht mitwandern — sonst verschiebt
     * sich beim Lesen einer Zeile die ganze Oberfläche.
     */
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <caption className="sr-only">
          Vergleich der ausgewählten Stellen. Ein Häkchen kennzeichnet den besten Wert einer Zeile,
          sofern mindestens zwei Spalten dazu eine Angabe haben.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-52 pb-4 pr-4 text-left align-bottom">
              <span className="sr-only">Merkmal</span>
            </th>
            {daten.spalten.map((s) => (
              <th
                key={s.id}
                scope="col"
                className="min-w-[9rem] pb-4 pr-4 text-left align-bottom font-normal"
              >
                <span className="grid gap-0.5">
                  {s.istEigene && (
                    <span className="abschnitts-titel text-ink-3">
                      Deine jetzige
                    </span>
                  )}
                  <span className="text-[15px] font-semibold leading-snug text-ink">{s.titel}</span>
                  {s.untertitel && <span className="text-2xs text-ink-2">{s.untertitel}</span>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {daten.zeilen.map((z) => {
            const gewinner = beteBySchluessel.get(z.key) ?? null;
            return (
              <tr key={z.key} className="border-t border-line align-top">
                <th scope="row" className="w-52 py-3.5 pr-5 text-left font-normal">
                  <span className="grid gap-0.5">
                    <span className="text-sm text-ink-2">{z.label}</span>
                    {z.hinweis && (
                      <span className="text-2xs leading-relaxed text-ink-3">{z.hinweis}</span>
                    )}
                  </span>
                </th>
                {z.zellen.map((c, i) => (
                  <td key={`${z.key}-${i}`} className="py-3.5 pr-4">
                    {c.art === "fehlt" ? (
                      <span className="text-sm text-ink-3">{c.grund}</span>
                    ) : c.art === "liste" ? (
                      <ul className="grid gap-1">
                        {c.werte.map((w) => (
                          <li key={w} className="text-sm text-ink">
                            {w}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="flex items-baseline gap-1.5">
                        <span
                          className={
                            gewinner === i
                              ? "font-mono text-sm font-semibold tabular text-ink"
                              : "font-mono text-sm tabular text-ink"
                          }
                        >
                          {c.anzeige}
                        </span>
                        {gewinner === i && (
                          <>
                            <Check
                              aria-hidden
                              className="size-3.5 shrink-0 translate-y-[1px] text-positive"
                              strokeWidth={2.4}
                            />
                            <span className="sr-only">bester Wert dieser Zeile</span>
                          </>
                        )}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
