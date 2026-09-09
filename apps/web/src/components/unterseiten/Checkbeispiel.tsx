"use client";

import { useState } from "react";
import { ANGABEN, ANZEIGE, BEISPIEL_KENNZEICHEN, NACHRICHT, WUNSCH, type Angabeart } from "@/lib/unterseiten/beispiel";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Check-Vorschau — dasselbe Beispiel auf allen Unterseiten
 * ══════════════════════════════════════════════════════════════════
 *
 * Drei Ansichten desselben Falls: die Anzeige, wie sie dasteht; was
 * Velvova daraus macht; und was man als Nächstes tun kann.
 *
 * ── Was hier nicht passiert ─────────────────────────────────────
 *
 * Kein Netzaufruf, keine Modellanfrage, keine echte Person. Beim
 * Umschalten wechselt ausschliesslich der sichtbare Ausschnitt eines
 * Textes, der in `lib/unterseiten/beispiel.ts` steht. Eine Vorschau,
 * die beim Klicken „analysiert", wäre eine Simulation — und die ist
 * ausdrücklich ausgeschlossen.
 *
 * Auch kein Autoplay. Ein Kasten, der von selbst weiterspringt,
 * nimmt dem Lesenden die Ansicht weg, die er gerade liest.
 *
 * ── Warum echte Knöpfe ──────────────────────────────────────────
 *
 * Mit `role="tablist"` und `aria-selected`, damit ein Vorleseprogramm
 * sagt, dass es drei Ansichten gibt und welche gilt. Ein `div` mit
 * Klick-Empfänger sagt gar nichts und ist mit der Tastatur nicht
 * erreichbar.
 */

const ANSICHTEN = [
  { key: "anzeige", text: "Anzeige" },
  { key: "einordnung", text: "Einordnung" },
  { key: "schritt", text: "Nächster Schritt" },
] as const;

type Ansicht = (typeof ANSICHTEN)[number]["key"];

/**
 * Die Farbe sagt die Art — aber nie allein.
 *
 * Neben dem Punkt steht immer auch das Wort. Wer Farben nicht
 * unterscheidet, sieht sonst drei gleich aussehende Listen; das ist
 * der häufigste vermeidbare Fehler an genau dieser Art Vorschau.
 */
const ART: Record<Angabeart, { wort: string; farbe: string }> = {
  bekannt: { wort: "Bekannt", farbe: "var(--color-accent)" },
  offen: { wort: "Offen", farbe: "var(--color-ink-3)" },
  widerspruch: { wort: "Widersprüchlich", farbe: "var(--signal-violet-text, var(--color-ink))" },
};

export function Checkbeispiel({ knapp = false }: { knapp?: boolean }) {
  const [ansicht, setAnsicht] = useState<Ansicht>(knapp ? "einordnung" : "anzeige");
  const [kopiert, setKopiert] = useState(false);

  return (
    <div
      className="grid gap-4 rounded-(--radius-lg) border border-line p-5 md:p-6"
      style={{ background: "var(--ed-surface)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-(--radius-pill) border border-line px-2.5 py-1 text-2xs uppercase tracking-[0.1em] text-ink-3">
          {BEISPIEL_KENNZEICHEN}
        </span>
      </div>

      <div role="tablist" aria-label="Ansicht des Beispiels" className="flex flex-wrap gap-1">
        {ANSICHTEN.map((a) => (
          <button
            key={a.key}
            type="button"
            role="tab"
            aria-selected={ansicht === a.key}
            onClick={() => setAnsicht(a.key)}
            className={[
              "min-h-10 rounded-(--radius-pill) px-3.5 text-[13px] transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              ansicht === a.key ? "bg-soft font-medium text-ink" : "text-ink-3 hover:text-ink",
            ].join(" ")}
          >
            {a.text}
          </button>
        ))}
      </div>

      {ansicht === "anzeige" ? (
        <div className="grid gap-2.5 rounded-(--radius-md) border border-line p-4" style={{ background: "var(--ed-canvas)" }}>
          <h3 className="text-[15px] font-semibold text-ink">{ANZEIGE.titel}</h3>
          <ul className="grid gap-1 text-[14px] leading-[1.6] text-ink-2">
            {ANZEIGE.zeilen.map((z) => (
              <li key={z}>{z}</li>
            ))}
          </ul>
          <p className="text-[14px] leading-[1.6] text-ink-2">{ANZEIGE.fliesstext}</p>
        </div>
      ) : null}

      {ansicht === "einordnung" ? (
        <ul className="grid gap-3">
          {ANGABEN.map((a) => (
            <li key={a.punkt} className="grid gap-1 border-t border-line pt-3 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-baseline gap-2">
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 translate-y-[-1px] rounded-full"
                  style={{ background: ART[a.art].farbe }}
                />
                <span className="text-2xs uppercase tracking-[0.08em] text-ink-3">
                  {ART[a.art].wort}
                </span>
                <span className="text-[14px] font-medium text-ink">{a.punkt}</span>
              </div>
              <p className="text-[13px] leading-[1.6] text-ink-3">{a.herkunft}</p>
            </li>
          ))}
          <li className="mt-1 grid gap-1 rounded-(--radius-md) border border-line p-3" style={{ background: "var(--ed-canvas)" }}>
            <p className="text-2xs uppercase tracking-[0.08em] text-ink-3">Wunsch des Beispielnutzers</p>
            <p className="text-[14px] text-ink">{WUNSCH.text}</p>
            <p className="text-[13px] leading-[1.6] text-ink-3">{WUNSCH.folge}</p>
          </li>
        </ul>
      ) : null}

      {ansicht === "schritt" ? (
        <div className="grid gap-3">
          <p className="text-[13px] leading-[1.6] text-ink-3">
            Aus den offenen Punkten und dem Widerspruch wird eine Nachricht. Velvova verschickt
            sie nicht — du entscheidest, ob und wohin.
          </p>
          <p
            className="rounded-(--radius-md) border border-line p-4 text-[14px] leading-[1.65] text-ink-2"
            style={{ background: "var(--ed-canvas)" }}
          >
            {NACHRICHT}
          </p>
          {/*
            Kopieren statt Versenden.

            Der Knopf tut genau das, was draufsteht, und braucht dafür
            kein Konto und keinen Dienst. `navigator.clipboard` kann
            fehlschlagen — ohne sicheren Kontext oder ohne Erlaubnis;
            dann bleibt der Text sichtbar und markierbar, und die
            Meldung behauptet nichts.
          */}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                ?.writeText(NACHRICHT)
                .then(() => {
                  setKopiert(true);
                  setTimeout(() => setKopiert(false), 2000);
                })
                .catch(() => setKopiert(false));
            }}
            className="inline-flex min-h-11 w-fit items-center rounded-(--radius-control) border border-line px-4 text-[14px] font-medium text-ink transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {kopiert ? "Kopiert" : "Nachricht kopieren"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
