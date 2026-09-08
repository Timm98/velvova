"use client";

import Link from "next/link";
import { useState } from "react";
import { ANGEBOTE, type Zielgruppe } from "@/lib/billing/preismodell";

/**
 * Preise und Pakete auf der Startseite.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Umschalter und nicht zwei Abschnitte
 * ══════════════════════════════════════════════════════════════
 *
 * Einzelpersonen und Unternehmen kaufen Verschiedenes: die eine Seite
 * die Begleitung einer eigenen Entscheidung, die andere klare
 * Stelleninformationen und gemeinsame Abläufe. Untereinander gestellt
 * liest jede Gruppe an fünf Karten vorbei, die ihr nichts sagen.
 *
 * Der Umschalter wählt ausschliesslich die Angebotsansicht. Er ändert
 * keine Kontorechte, keinen Bereich und keinen Zustand ausserhalb
 * dieses Abschnitts — sonst wäre er eine Anmeldung, die wie ein
 * Reiter aussieht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum manche Karten sagen, dass es sie noch nicht gibt
 * ══════════════════════════════════════════════════════════════
 *
 * Das Modell vom 9. September 2026 ist eine beschlossene
 * Arbeitsfassung, kein abgenommener Verkaufsstand. Kontingente,
 * Zählweise, Ablauffristen und der Zahlungsweg dahinter sind noch
 * nicht freigegeben.
 *
 * Ein Angebot, das man kaufen kann, bevor es funktioniert, ist der
 * teuerste Fehler, den diese Seite machen kann — teurer als gar keine
 * Preise zu zeigen. Deshalb steht es an der Karte und nicht in einer
 * Fussnote: sichtbar, bevor jemand klickt.
 */
export function Abomodell({ angemeldet }: { angemeldet: boolean }) {
  const [wer, setWer] = useState<Zielgruppe>("person");
  const angebote = ANGEBOTE[wer];

  return (
    <section
      aria-labelledby="preise"
      className="mx-auto w-full max-w-[1240px] px-5 py-20 md:px-8 md:py-24"
    >
      <div className="grid gap-4">
        <h2
          id="preise"
          className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-normal leading-tight tracking-[-0.02em]"
        >
          Was Velvova kostet
        </h2>
        <p className="max-w-[54ch] text-[15px] leading-relaxed text-ink-2">
          Einzelpersonen bezahlen für die Begleitung ihrer eigenen Wechselentscheidung. Unternehmen
          für klare Stelleninformationen und gemeinsame Abläufe. Niemand kauft Einfluss auf Ninas
          Rat.
        </p>

        {/*
          Zwei echte Knöpfe in einer Gruppe, kein nachgebauter Reiter.

          `aria-pressed` sagt einem Vorleseprogramm, welcher Zustand
          gilt; ein `div` mit Klick-Empfänger sagt gar nichts und ist
          mit der Tastatur nicht erreichbar.
        */}
        <div
          role="group"
          aria-label="Angebote für"
          className="mt-2 inline-flex w-fit gap-1 rounded-(--radius-pill) bg-soft p-1"
        >
          {(
            [
              ["person", "Einzelpersonen"],
              ["unternehmen", "Unternehmen"],
            ] as const
          ).map(([k, text]) => (
            <button
              key={k}
              type="button"
              aria-pressed={wer === k}
              onClick={() => setWer(k)}
              className={[
                "min-h-10 rounded-(--radius-pill) px-4 text-sm transition-colors duration-(--duration-fast)",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                wer === k ? "bg-raised font-medium text-ink shadow-sm" : "text-ink-2 hover:text-ink",
              ].join(" ")}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {/* Das Raster folgt der Zahl der Karten, nicht umgekehrt: Zwei
          Angebote in drei Spalten lassen eine Lücke, die wie ein
          fehlendes drittes Paket aussieht. */}
      <ul
        className={[
          "mt-10 grid gap-4",
          angebote.length === 2 ? "md:grid-cols-2 lg:max-w-[820px]" : "md:grid-cols-3",
        ].join(" ")}
      >
        {angebote.map((a) => (
          <li
            key={a.key}
            className={[
              "grid content-start gap-5 rounded-(--radius-lg) border p-6",
              a.betont ? "border-accent" : "border-line",
            ].join(" ")}
            style={{ background: "var(--ed-surface)" }}
          >
            <div className="grid gap-1">
              <h3 className="font-display text-xl font-medium">{a.name}</h3>
              <p className="text-[15px] leading-relaxed text-ink-2">{a.nutzen}</p>
            </div>

            <p className="flex items-baseline gap-1.5">
              {/*
                Keine Monospace für den Preis.

                `font-mono tabular-nums` ist für Tabellen richtig, in
                denen Ziffern untereinander stehen müssen. Hier steht
                eine einzelne Zahl im Fliesstext, und die feste
                Zeichenbreite zerlegte sie sichtbar: aus „14,90 €"
                wurde „14 , 90 €", weil auch Komma und Leerzeichen
                eine volle Zelle bekamen.
              */}
              <span className="font-display text-3xl font-medium">{a.preis}</span>
              {a.takt ? <span className="text-sm text-ink-2">{a.takt}</span> : null}
            </p>

            <ul className="grid gap-2 border-t border-line pt-5">
              {a.punkte.map((p) => (
                <li key={p} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-2">
                  {/*
                    Ein Strich, kein Häkchen. Ein grünes Häkchen sagt
                    „erledigt" oder „geprüft"; hier steht, was
                    enthalten ist.
                  */}
                  <span aria-hidden className="mt-2.5 h-px w-2.5 shrink-0 bg-ink-3" />
                  {p}
                </li>
              ))}
            </ul>

            {a.nochNicht ? (
              <p className="rounded-(--radius-md) border border-line px-3 py-2 text-2xs leading-relaxed text-ink-3">
                Noch nicht buchbar. Wir sagen Bescheid, sobald dieses Paket freigegeben ist.
              </p>
            ) : null}

            <Link
              href={a.nochNicht ? "/help" : angemeldet ? a.aktion.ziel : a.aktion.ziel}
              className={[
                "flex h-11 items-center justify-center rounded-(--radius-control) text-sm font-medium transition-colors duration-(--duration-fast)",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                a.betont && !a.nochNicht
                  ? "bg-accent text-white hover:opacity-90"
                  : "border border-line text-ink hover:border-accent",
              ].join(" ")}
            >
              {a.nochNicht ? "Benachrichtigen lassen" : a.aktion.text}
            </Link>

            {a.fussnote ? (
              <p className="text-2xs leading-relaxed text-ink-3">{a.fussnote}</p>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="mt-6 max-w-[64ch] text-2xs leading-relaxed text-ink-3">
        {wer === "person"
          ? "Der erste vollständige Check bleibt kostenlos und verschwindet nicht nachträglich hinter einer Schranke. Bezahlt wird erst zusätzliche Verarbeitung darüber hinaus. Eine laufende Begleitung im Monatsabo bieten wir an, sobald wir sehen, dass sie gebraucht wird."
          : "Preise je Organisation, nicht je Bearbeiter. Kein bezahltes Ranking, keine Arbeitgebersiegel: Wer zahlt, erscheint in der Suche nicht weiter oben. Bewerberdaten bleiben getrennt — ein Firmenzugang sieht keinen privaten Check."}
      </p>
    </section>
  );
}
