"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AUSSENVERWEISE } from "@paycheck/config";

/**
 * ══════════════════════════════════════════════════════════════════
 * „App herunterladen" — mit dem Zeichen des Geräts, auf dem man sitzt
 * ══════════════════════════════════════════════════════════════════
 *
 * Vier Fälle, und jeder bekommt sein eigenes Zeichen und seinen
 * eigenen Satz:
 *
 *   Mac        Apfel     „Desktop-App herunterladen"
 *   Windows    Fenster   „Desktop-App herunterladen"
 *   iPhone     Apfel     „Handy-App herunterladen"
 *   Android    Roboter   „Handy-App herunterladen"
 *
 * ── Warum das im Browser entschieden wird und nicht am Server ───
 *
 * Der Server kennt nur die Kennung, die der Browser mitschickt, und
 * die ist bei genau der Frage am unzuverlässigsten: iPads melden sich
 * seit Jahren als Mac, und Sparmodi kürzen sie. Vor allem aber wäre
 * die Seite damit für jedes Gerät eine andere — sie liesse sich nicht
 * mehr zwischenspeichern, und das für eine Zeile.
 *
 * Deshalb: Der Server liefert den neutralen Fall aus, und nach dem
 * ersten Zeichnen tritt das Gerät an seine Stelle. Wer kein
 * JavaScript hat, bekommt den neutralen — und der ist nicht falsch,
 * nur allgemeiner.
 *
 * ── Warum es kein toter Knopf ist ───────────────────────────────
 *
 * Alle drei Adressen stehen in der Konfiguration auf `null`, weil es
 * die Dateien noch nicht gibt. Solange steht hier ein Hinweis und
 * kein Knopf: Ein „Herunterladen", das nichts herunterlädt, ist ein
 * Betrug am ersten Klick.
 *
 * Sobald eine Adresse eingetragen ist, wird daraus ein echtes
 * Herunterladen — für genau die Plattform, für die sie eingetragen
 * wurde. Die anderen bleiben beim Hinweis.
 */

type Plattform = "mac" | "windows" | "ios" | "android" | "unbekannt";

/**
 * Was für ein Gerät ist das?
 *
 * Die Reihenfolge ist nicht beliebig. Android-Kennungen enthalten das
 * Wort „Linux", iPad-Kennungen enthalten „Mac" — wer zuerst auf die
 * gröbere Angabe prüft, ordnet beide falsch ein. Deshalb erst die
 * eindeutigen Fälle, dann die weiten.
 */
function geraet(): Plattform {
  if (typeof navigator === "undefined") return "unbekannt";
  const kennung = navigator.userAgent;

  if (/Android/i.test(kennung)) return "android";
  if (/iPhone|iPod/i.test(kennung)) return "ios";
  /*
   * Das iPad, das sich für einen Mac hält.
   *
   * Seit iPadOS 13 schickt es die Mac-Kennung. Der einzige
   * verlässliche Unterschied ist der Berührungsbildschirm: Ein Mac
   * meldet keine Berührungspunkte, ein iPad fünf.
   */
  if (/iPad/i.test(kennung)) return "ios";
  if (/Macintosh/i.test(kennung)) {
    return navigator.maxTouchPoints > 1 ? "ios" : "mac";
  }
  if (/Windows/i.test(kennung)) return "windows";
  return "unbekannt";
}

const ZEICHEN: Record<Exclude<Plattform, "unbekannt">, { datei: string; alt: string }> = {
  mac: { datei: "apple", alt: "" },
  ios: { datei: "apple", alt: "" },
  windows: { datei: "windows", alt: "" },
  android: { datei: "android", alt: "" },
};

export function AppHolen({ className = "" }: { className?: string }) {
  /*
   * Erst nach dem Einhängen umschalten.
   *
   * Server und Browser müssen beim ersten Zeichnen dasselbe ergeben,
   * sonst verwirft React den Baum und zeichnet neu — sichtbar als
   * Sprung. `useEffect` läuft nach diesem ersten Zeichnen.
   */
  const [wo, setWo] = useState<Plattform>("unbekannt");
  useEffect(() => setWo(geraet()), []);

  const handy = wo === "ios" || wo === "android";
  const text = handy ? "Handy-App herunterladen" : "Desktop-App herunterladen";
  const ziel =
    wo === "ios"
      ? AUSSENVERWEISE.iosUrl
      : wo === "android"
        ? AUSSENVERWEISE.androidUrl
        : AUSSENVERWEISE.desktopUrl;

  const zeichen = wo === "unbekannt" ? null : ZEICHEN[wo];

  const inhalt = (
    <>
      {zeichen ? (
        /*
          Beide Fassungen stehen im Markup, umgeschaltet wird über CSS
          — genau wie bei den Zahlungsarten und den Partnerkacheln. Ein
          Wechsel per JavaScript käme erst nach der Hydratation und
          zeigte beim Laden für einen Moment das falsche Zeichen.

          `alt=""` und `aria-hidden`: Der Satz daneben sagt bereits,
          worum es geht. „Apple-Logo, Desktop-App herunterladen" wäre
          eine Vokabel zu viel.
        */
        <span className="plattformzeichen inline-flex shrink-0 items-center">
          <Image
            src={`/plattform/${zeichen.datei}-hell.png`}
            alt=""
            aria-hidden
            width={20}
            height={20}
            className="fuer-hell h-[18px] w-auto object-contain"
          />
          <Image
            src={`/plattform/${zeichen.datei}-dunkel.png`}
            alt=""
            aria-hidden
            width={20}
            height={20}
            className="fuer-dunkel h-[18px] w-auto object-contain"
          />
        </span>
      ) : null}
      {text}
    </>
  );

  if (!ziel) {
    return (
      <p className={`flex items-center justify-center gap-2.5 text-sm text-ink-3 ${className}`}>
        {zeichen ? (
          <span className="plattformzeichen inline-flex shrink-0 items-center opacity-70">
            <Image
              src={`/plattform/${zeichen.datei}-hell.png`}
              alt=""
              aria-hidden
              width={20}
              height={20}
              className="fuer-hell h-[18px] w-auto object-contain"
            />
            <Image
              src={`/plattform/${zeichen.datei}-dunkel.png`}
              alt=""
              aria-hidden
              width={20}
              height={20}
              className="fuer-dunkel h-[18px] w-auto object-contain"
            />
          </span>
        ) : null}
        {handy ? "Handy-App: kommt bald" : "Desktop-App: kommt bald"}
      </p>
    );
  }

  return (
    <a
      href={ziel}
      className={`mx-auto inline-flex min-h-12 w-fit items-center justify-center gap-2.5 rounded-(--radius-control) border border-line-3 px-5 text-sm font-medium text-ink transition-colors hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      {inhalt}
    </a>
  );
}
