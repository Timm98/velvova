import { Laufband } from "@/components/ui/Laufband";
import { Sterne } from "./Sterne";
import { fuerStartseite, kennzahlen } from "@/lib/reviews/lesen";

/**
 * Kundenstimmen auf der Startseite der Anwendung.
 *
 * ── Warum Beispiele sichtbar als Beispiele ────────────────────
 *
 * Solange es keine echten Bewertungen gibt, stehen hier
 * Beispieldarstellungen — und sie sagen das auch, in einer Zeile
 * darüber und in einem Etikett an jeder Karte.
 *
 * Erfundene Stimmen als echte auszugeben ist Werbung mit falschen
 * Zeugen; es steht so auch in `CLAUDE.md`. Gar nichts zu zeigen
 * hiesse, den Abschnitt erst zu bauen, wenn er gebraucht wird — und
 * dann fällt niemandem auf, dass er fehlt.
 *
 * Der Weg dazwischen: Der Abschnitt steht, sieht fertig aus, und
 * niemand wird getäuscht. Sobald echte Bewertungen eingehen,
 * verschwinden die Beispiele von selbst — `fuerStartseite()`
 * entscheidet das, nicht ein Schalter.
 */

type Stimme = {
  id: string;
  bewertung: number;
  titel: string;
  text: string;
  name: string;
  rolle: string;
};

/*
 * Bewusst gehaltlos formuliert.
 *
 * Sie nennen keine Zahlen, keine Gehaltssprünge und keine Fristen —
 * nichts, was jemand für eine Zusage halten könnte. Sie zeigen die
 * Form des Abschnitts, nicht behauptete Ergebnisse.
 */
const BEISPIELE: Stimme[] = [
  {
    id: "b1",
    bewertung: 5,
    titel: "Endlich Begründungen statt Trefferlisten",
    text: "Zu jeder Stelle stand da, warum sie vorgeschlagen wurde — und was dagegen sprach. Das hatte ich vorher nirgends.",
    name: "Beispielstimme",
    rolle: "So könnte eine Bewertung aussehen",
  },
  {
    id: "b2",
    bewertung: 5,
    titel: "Das Gespräch war schneller als jedes Formular",
    text: "Statt Felder auszufüllen habe ich erzählt, was mir wichtig ist. Danach passte die Auswahl.",
    name: "Beispielstimme",
    rolle: "So könnte eine Bewertung aussehen",
  },
  {
    id: "b3",
    bewertung: 5,
    titel: "Gehalt und Fahrweg standen dabei",
    text: "Beides war vorher da, nicht erst im Vorstellungsgespräch. Das spart die Hälfte der Absagen.",
    name: "Beispielstimme",
    rolle: "So könnte eine Bewertung aussehen",
  },
];

export async function StimmenStreifen() {
  const [zahlen, echte] = await Promise.all([
    kennzahlen().catch(() => ({ schnitt: null as number | null, anzahl: 0 })),
    fuerStartseite(3).catch(() => []),
  ]);

  const beispielhaft = echte.length === 0;
  const stimmen: Stimme[] = beispielhaft
    ? BEISPIELE
    : echte.map((b) => ({
        id: b.id,
        bewertung: b.rating,
        titel: b.headline ?? "",
        text: b.body,
        name: b.displayName,
        rolle: b.roleOrCompany ?? "",
      }));

  return (
    <section aria-labelledby="stimmen" className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="stimmen" className="font-display text-xl font-semibold tracking-[-0.02em]">
          Bisherige Nutzererfahrungen
        </h2>
        {!beispielhaft && zahlen.schnitt !== null && (
          <span className="flex items-center gap-2 text-sm text-ink-2">
            <Sterne wert={zahlen.schnitt} groesse="sm" />
            <span className="tabular-nums">
              {zahlen.schnitt.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-ink-3">aus {zahlen.anzahl}</span>
          </span>
        )}
      </div>

      {beispielhaft && (
        <p className="text-sm text-ink-3">
          Beispieldarstellung — echte Bewertungen erscheinen hier, sobald die ersten eingegangen
          sind.
        </p>
      )}

      {/*
        Von Hand blättern, nicht von selbst laufen.

        Das Band lief zuerst automatisch — und war damit genau das
        falsche Element dafür: Eine Bewertung will gelesen werden, und
        ein Text, der wegläuft, während man liest, ist eine Zumutung.
        Die Stellen weiter unten laufen; die Stimmen warten.
      */}
      <Laufband beschriftung="Nutzererfahrungen" tempo={0}>
        {stimmen.map((s) => (
          <article
            key={s.id}
            className="grid w-[19rem] shrink-0 content-start gap-2.5 rounded-(--radius-lg) border border-line bg-surface px-5 py-4"
          >
            <Sterne wert={s.bewertung} groesse="sm" />
            {s.titel && <p className="text-sm font-semibold leading-snug text-ink">{s.titel}</p>}
            <p className="text-sm leading-relaxed text-ink-2">{s.text}</p>
            <p className="mt-1 text-2xs text-ink-3">
              {s.name}
              {s.rolle && ` · ${s.rolle}`}
            </p>
          </article>
        ))}
      </Laufband>
    </section>
  );
}
