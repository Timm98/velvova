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
      {/*
        Überschrift und Umschalter mittig.

        Die Vorlage stellt beides über die Karten und zentriert es. Das
        ist nicht Geschmack: Der Umschalter gehört zu allen drei Karten
        gleichermassen, und linksbündig sieht er aus, als gehöre er zur
        ersten.
      */}
      <div className="grid justify-items-center gap-4 text-center">
        <h2
          id="preise"
          className="font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-normal leading-tight tracking-[-0.02em]"
        >
          Pläne erkunden
        </h2>
        <p className="max-w-[58ch] text-[15px] leading-relaxed text-ink-2">
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
          className="mt-2 inline-flex gap-1 rounded-(--radius-pill) bg-soft p-1"
        >
          {(
            [
              ["person", "Einzelperson"],
              ["unternehmen", "Unternehmen"],
            ] as const
          ).map(([k, text]) => (
            <button
              key={k}
              type="button"
              aria-pressed={wer === k}
              onClick={() => setWer(k)}
              className={[
                "min-h-10 rounded-(--radius-pill) px-5 text-sm transition-colors duration-(--duration-fast)",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                wer === k ? "bg-raised font-medium text-ink shadow-sm" : "text-ink-2 hover:text-ink",
              ].join(" ")}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {/* `items-stretch` und `h-full` an der Karte: Sonst ist jede Karte
          so hoch wie ihr Inhalt, und drei verschieden lange Listen
          ergeben drei verschieden hohe Kästen mit versetzten
          Unterkanten. */}
      {/*
        ══════════════════════════════════════════════════════════
        Warum hier `subgrid` steht und keine festen Höhen
        ══════════════════════════════════════════════════════════

        Die vier Blöcke jeder Karte — Kopf, Preis, Knopf, Merkmale —
        sollen über alle drei Karten auf derselben Höhe beginnen. Vorher
        taten sie das nicht: „Wenn mehrere Entscheidungen gleichzeitig
        laufen." bricht auf zwei Zeilen, „Kostenlos für alle" nicht, und
        schon standen Preis und Knopf um eine Zeilenhöhe versetzt.

        Der übliche Notbehelf wäre eine Mindesthöhe je Block — geraten,
        und beim nächsten längeren Satz wieder falsch. `subgrid` dreht
        das um: Das äussere Raster legt vier Zeilen an, jede so hoch wie
        ihr höchster Inhalt, und die Karten hängen sich mit
        `grid-rows-subgrid` genau dort ein. Keine Zahl, die jemand
        pflegen muss.

        Nur ab `md`: Untereinander gibt es nichts auszurichten, und die
        Karten sollen dort so hoch sein wie ihr Inhalt.
      */}
      <ul className="mt-12 grid items-stretch gap-4 md:grid-cols-3 md:grid-rows-[auto_auto_auto_1fr]">
        {angebote.map((a) => (
          <li
            key={a.key}
            className={[
              "grid h-full content-start gap-6 rounded-(--radius-lg) p-7",
              "md:row-span-4 md:grid-rows-subgrid",
              /*
               * Die hervorgehobene Stufe bekommt eine Linie in der
               * Akzentfarbe — im Dunkeln blau, im Hellen orange, weil
               * `--color-accent` dem Thema folgt.
               *
               * Zwei Anläufe, und der Wert steht zwischen ihnen. Voll
               * gedeckt mit einem Schein dahinter sah die Karte aus
               * wie ausgewählt statt wie empfohlen, und die beiden
               * anderen wirkten daneben wie Restposten. Bei 55 Prozent
               * war sie dann nicht mehr zu sehen — gemessen war die
               * Linie da, gemeldet wurde „die Umrandung ist weg".
               *
               * 85 Prozent ohne Schein: deutlich genug, um eine
               * Empfehlung zu sein, ruhig genug, um die Nachbarn nicht
               * zu entwerten.
               */
              /*
               * Zwei Pixel bei der hervorgehobenen, einer bei den
               * anderen — und das ist der eigentliche Unterschied.
               *
               * Bei einem Pixel war die Linie gemessen vorhanden
               * (`color(srgb … / 0.85)` am Rand der Karte) und wurde
               * trotzdem zweimal als „die Umrandung ist weg" gemeldet.
               * Eine Haarlinie in gedecktem Blau auf dunklem Grund
               * liest niemand als Auszeichnung; sie sieht aus wie die
               * Kante daneben, nur minimal anders getönt.
               *
               * Die Stärke trägt hier, nicht die Farbe — und das ist
               * der ganze Trick. Drei Anläufe:
               *
               *   1 px / 55 %   gemessen vorhanden, gemeldet als „weg"
               *   1 px / 85 %   dasselbe noch einmal
               *   2 px / 85 %   gemeldet als „zu stark"
               *   2 px / 45 %   deutlich, ohne zu schreien
               *
               * Bei einem Pixel entscheidet die Deckung darüber, ob
               * man die Linie überhaupt sieht; bei zweien darüber, wie
               * laut sie ist. Deshalb dick und blass statt dünn und
               * satt. Kein Schein dahinter — der liess die Karte
               * aussehen wie ausgewählt statt wie empfohlen.
               *
               * ── Und warum die anderen zwei auch eine bekommen ──
               *
               * Weil eine einzelne farbige Kontur zwischen zwei
               * beinahe unsichtbaren Kanten (`--line` liegt bei zehn
               * Prozent Deckung) nicht wie eine Empfehlung aussieht,
               * sondern wie ein Fehler an genau dieser Karte.
               *
               * Alle drei tragen jetzt dieselbe Kontur in der
               * Akzentfarbe, die oberste nur deutlicher. Damit ist der
               * Unterschied ein Unterschied im Grad und nicht in der
               * Art — und die Reihe liest sich als eine Reihe.
               *
               * `--color-accent` folgt dem Thema: im Dunkeln blau, im
               * Hellen orange. Hier steht deshalb keine Farbe,
               * sondern nur, wie viel davon.
               */
              a.betont
                ? "border-2 border-[rgb(from_var(--color-accent)_r_g_b_/_0.45)]"
                : "border border-[rgb(from_var(--color-accent)_r_g_b_/_0.28)]",
            ].join(" ")}
            style={{ background: "var(--ed-surface)" }}
          >
            {/*
              Kopf: Name, ein Satz, dann der Preis mit seiner
              Erläuterungszeile.

              Der Vorbehalt steht direkt am Preis. In einer Fussnote
              unter allen Karten läse ihn, wer schon entschieden hat.
            */}
            <div className="grid gap-1.5">
              <h3 className="font-display text-2xl font-normal">{a.name}</h3>
              <p className="text-[15px] leading-relaxed text-ink-2">{a.nutzen}</p>
            </div>

            <div className="grid gap-1.5">
              {/*
                `tracking-[-0.02em]`: Die Titelschrift setzt Komma und
                geschütztes Leerzeichen grosszügig, und bei 40 Pixeln
                Schriftgrad wird daraus sichtbar „9 , 90 €". Dieselbe
                Enge, die die Überschriften der Seite ohnehin tragen.
              */}
              <p className="font-display text-[2.5rem] font-normal leading-none tracking-[-0.02em]">
                {a.preis}
              </p>
              <p className="text-[13px] leading-relaxed text-ink-3">{a.taktzeile}</p>
            </div>

            {/*
              Der Knopf steht über der Liste, nicht darunter.

              Wer die Stufe schon kennt, muss nicht erst an fünf Zeilen
              vorbei. Wer sie nicht kennt, liest die Liste ohnehin — und
              findet den Knopf danach wieder, weil er die volle Breite
              hat.
            */}
            <div className="grid gap-2">
              <Link
                href={a.nochNicht ? "/help" : a.aktion.ziel}
                className={[
                  "flex h-12 items-center justify-center rounded-(--radius-control) text-sm font-medium transition-colors duration-(--duration-fast)",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  a.betont && !a.nochNicht
                    ? "bg-accent text-white hover:opacity-90"
                    : "border border-line text-ink hover:border-accent",
                ].join(" ")}
              >
                {a.nochNicht ? "Benachrichtigen lassen" : a.aktion.text}
              </Link>
              {a.nochNicht ? (
                <p className="text-center text-2xs leading-relaxed text-ink-3">
                  Noch nicht buchbar — wir sagen Bescheid, sobald diese Stufe freigegeben ist.
                </p>
              ) : a.knopffussnote ? (
                <p className="text-center text-2xs text-ink-3">{a.knopffussnote}</p>
              ) : null}
            </div>

            <div className="grid content-start gap-3 self-stretch border-t border-line pt-6">
              {a.ueberleitung ? (
                <p className="text-[14px] font-semibold text-ink">{a.ueberleitung}</p>
              ) : null}
              <ul className="grid gap-2.5">
                {a.punkte.map((p) => (
                  <li key={p} className="flex gap-3 text-[14px] leading-relaxed text-ink-2">
                    {/*
                      Ein Häkchen wie in der Vorlage — und `aria-hidden`,
                      weil ein Vorleseprogramm sonst vor jeder Zeile
                      „Häkchen" sagt. Die Liste ist bereits eine Liste;
                      dass ihre Punkte enthalten sind, sagt die
                      Überschrift darüber.
                    */}
                    <svg
                      aria-hidden
                      viewBox="0 0 16 16"
                      className="mt-1 size-3.5 shrink-0 text-ink-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 8.5 6.5 12 13 4.5" />
                    </svg>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>

      <p className="mx-auto mt-8 max-w-[72ch] text-center text-2xs leading-relaxed text-ink-3">
        {wer === "person"
          ? "Der erste vollständige Check bleibt kostenlos und verschwindet nicht nachträglich hinter einer Schranke. Kontingente, Zählweise und Ablauf stehen vor dem Kauf fest; ungenutzte Einheiten werden nicht angespart. Preise inklusive anwendbarer Umsatzsteuer, Änderungen vorbehalten."
          : "Preise je Organisation, nicht je Bearbeiter, und zuzüglich anwendbarer Umsatzsteuer. Kein bezahltes Ranking, keine Arbeitgebersiegel: Wer zahlt, erscheint in der Suche nicht weiter oben. Bewerberdaten bleiben getrennt — ein Firmenzugang sieht keinen privaten Check."}
      </p>
    </section>
  );
}
