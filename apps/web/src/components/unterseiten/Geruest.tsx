import Link from "next/link";
import type { ReactNode } from "react";

/**
 * ══════════════════════════════════════════════════════════════════
 * Das Gerüst der Unterseiten
 * ══════════════════════════════════════════════════════════════════
 *
 * Ein eigener Namensraum, und der Grund steht im Auftrag: Header,
 * Fusszeile und Startseite bleiben unverändert. Ein Bauteil, das sich
 * beide teilen, kann man nicht für die eine Seite verbessern, ohne die
 * andere anzufassen — deshalb liegen die Unterseiten-Bauteile hier und
 * fassen nichts Globales an.
 *
 * Keine Regel für `body`, `html`, `h1`, `button`, `section` oder
 * `:root`. Keine neue Farbe. Alles, was hier gesetzt wird, hängt an
 * einer Klasse dieses Verzeichnisses.
 *
 * ── Warum 1120 und nicht die 1200 der Startseite ────────────────
 *
 * `--breite-inhalt` ist 1200 Pixel, und dabei bleibt es — das Token
 * gehört Header und Startseite. Die Unterseiten sind Lesestoff, kein
 * Raster aus Karten: Bei 1200 Pixeln wird eine Textspalte über 100
 * Zeichen breit, und ab etwa 75 verliert das Auge beim Zeilenwechsel
 * die Zeile. 1120 aussen, 68 Zeichen innen.
 */

const AUSSEN = "mx-auto w-full max-w-[1120px] px-5 md:px-8";

/** Lesebreite für Fliesstext: ungefähr 60 bis 68 Zeichen. */
export const LESEBREITE = "max-w-[64ch]";

/**
 * Der Seiteneinstieg.
 *
 * Links Text und höchstens zwei Aktionen, rechts eine Vorschau, die
 * etwas zeigt — kein zweites abstraktes Objekt. Auf schmalen Geräten
 * untereinander, und zwar Text zuerst: Wer auf dem Telefon ankommt,
 * soll nicht erst an einer Grafik vorbeiscrollen, um zu erfahren,
 * worum es geht.
 */
export function Einstieg({
  oberzeile,
  titel,
  text,
  aktionen,
  vorschau,
}: {
  oberzeile: string;
  titel: string;
  text: string;
  aktionen?: ReactNode;
  vorschau?: ReactNode;
}) {
  return (
    <section className={`${AUSSEN} pb-14 pt-10 md:pb-20 md:pt-16`}>
      <div
        className={
          vorschau
            ? /*
              Text bekommt mehr als die Hälfte, nicht weniger.
              
              Bei 1fr zu 0,9fr blieben der Überschrift rund 500 Pixel,
              und „Finde nicht nur eine Stelle. Verstehe, ob sie zu dir
              passt." brach auf vier Zeilen — bei 64 Pixeln Schriftgrad
              ein Block, der die halbe Bildhöhe füllt. Die Vorschau
              daneben braucht die Breite nicht: Sie ist eine Liste
              kurzer Zeilen.
            */
              "grid items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-14"
            : "grid gap-10"
        }
      >
        <div className="grid gap-5">
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-3">
            {oberzeile}
          </p>
          {/*
            52 bis 64 Pixel auf dem Desktop, 34 bis 40 mobil — als
            `clamp`, damit dazwischen nichts springt. Keine feste
            Zeilenzahl: Deutsche Überschriften sind länger als
            englische, und eine erzwungene Zeile bricht mitten im Wort.
          */}
          <h1 className="font-display text-[clamp(2.125rem,4.6vw,4rem)] font-normal leading-[1.05] tracking-[-0.02em]">
            {titel}
          </h1>
          <p className={`${LESEBREITE} text-[17px] leading-[1.6] text-ink-2`}>{text}</p>
          {aktionen ? <div className="mt-2 flex flex-wrap gap-3">{aktionen}</div> : null}
        </div>
        {vorschau ? <div className="min-w-0">{vorschau}</div> : null}
      </div>
    </section>
  );
}

/**
 * Ein Abschnitt.
 *
 * 80 bis 104 Pixel Abstand auf dem Desktop, 48 bis 64 mobil. Keine
 * bildschirmhohen Leerflächen: Abstand allein macht eine Seite nicht
 * hochwertig, er macht sie nur länger.
 */
export function Abschnitt({
  titel,
  text,
  kinder,
  id,
}: {
  titel?: string;
  text?: string;
  kinder: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={`${AUSSEN} py-12 md:py-[104px]`}>
      {titel ? (
        <div className="grid gap-4">
          <h2 className="font-display text-[clamp(1.75rem,3vw,2.5rem)] font-normal leading-tight tracking-[-0.02em]">
            {titel}
          </h2>
          {text ? (
            <p className={`${LESEBREITE} text-[17px] leading-[1.6] text-ink-2`}>{text}</p>
          ) : null}
        </div>
      ) : null}
      <div className={titel ? "mt-10" : ""}>{kinder}</div>
    </section>
  );
}

/**
 * Ein Einstieg als Karte: Aufgabe, zwei Sätze, ein echtes Ziel.
 *
 * ── Warum `ziel` auch `null` sein darf ──────────────────────────
 *
 * Weil es Funktionen gibt, die es noch nicht gibt. Eine Karte ohne
 * Ziel bekommt dann den Verweis auf das gekennzeichnete Beispiel —
 * nicht `href="#"`, kein leeres Formular, keine Auswertung, die nur
 * so aussieht. Das Register in `lib/unterseiten/verfuegbarkeit.ts`
 * entscheidet darüber, nicht der Text hier.
 */
export function Einstiegskarte({
  titel,
  text,
  ziel,
  aktion,
}: {
  titel: string;
  text: string;
  ziel: string;
  aktion: string;
}) {
  return (
    <li
      className="grid content-start gap-3 rounded-(--radius-lg) border border-line p-6 md:p-7"
      style={{ background: "var(--ed-surface)" }}
    >
      <h3 className="font-display text-xl font-normal">{titel}</h3>
      <p className="text-[15px] leading-[1.6] text-ink-2">{text}</p>
      <Link
        href={ziel}
        className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-accent-text underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {aktion}
      </Link>
    </li>
  );
}

/**
 * Die Hauptaktion eines Abschnitts. Höchstens eine je Abschnitt.
 *
 * 44 Pixel Mindesthöhe ist keine Geschmacksfrage, sondern die
 * Zielgrösse, unter der ein Finger danebentrifft.
 */
export function Hauptknopf({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center rounded-(--radius-control) bg-accent px-6 text-[15px] font-semibold text-accent-on transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </Link>
  );
}

export function Nebenknopf({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center rounded-(--radius-control) border border-line px-6 text-[15px] font-medium text-ink transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </Link>
  );
}

/**
 * Der Abschluss.
 *
 * Ein Satz und ein Weg — nicht die dritte Sammlung von
 * Nutzenversprechen am Seitenende. Wer bis hierher gelesen hat, will
 * wissen, was er jetzt tun kann.
 */
export function Abschluss({
  titel,
  text,
  aktionen,
}: {
  titel: string;
  text: string;
  aktionen: ReactNode;
}) {
  return (
    <section className={`${AUSSEN} py-12 md:py-[104px]`}>
      <div
        className="grid gap-5 rounded-(--radius-lg) border border-line p-8 md:p-12"
        style={{ background: "var(--ed-surface)" }}
      >
        <h2 className="font-display text-[clamp(1.6rem,2.6vw,2.125rem)] font-normal leading-tight tracking-[-0.02em]">
          {titel}
        </h2>
        <p className={`${LESEBREITE} text-[16px] leading-[1.6] text-ink-2`}>{text}</p>
        <div className="mt-2 flex flex-wrap gap-3">{aktionen}</div>
      </div>
    </section>
  );
}

/**
 * Ein kleiner, nachgeordneter Ausblick.
 *
 * Bewusst schmaler und ruhiger als alles darüber. Was hier steht, ist
 * nicht gebaut — und soll deshalb nicht aussehen wie das, was gebaut
 * ist. Kein Datum, keine Aktion.
 */
export function Ausblick({
  titel,
  einleitung,
  punkte,
}: {
  titel: string;
  einleitung: string;
  punkte: readonly { titel: string; text: string }[];
}) {
  return (
    <section className={`${AUSSEN} py-12 md:py-[104px]`}>
      <div className="grid gap-3">
        <h2 className="font-display text-[clamp(1.4rem,2.2vw,1.75rem)] font-normal tracking-[-0.02em]">
          {titel}
        </h2>
        <p className={`${LESEBREITE} text-[15px] leading-[1.6] text-ink-3`}>{einleitung}</p>
      </div>
      <ul className="mt-7 grid gap-x-8 gap-y-6 md:grid-cols-3">
        {punkte.map((p) => (
          <li key={p.titel} className="grid content-start gap-2 border-t border-line pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold text-ink">{p.titel}</h3>
              {/*
                „In Vorbereitung“ steht an jedem einzelnen Punkt und
                nicht einmal über der Liste. Eine Überschrift liest,
                wer von oben kommt; wer quer liest, sieht nur die drei
                Titel — und hielte sie ohne diese Marke für Funktionen.
              */}
              <span className="rounded-(--radius-pill) border border-line px-2 py-0.5 text-2xs text-ink-3">
                In Vorbereitung
              </span>
            </div>
            <p className="text-[14px] leading-[1.6] text-ink-3">{p.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Drei Schritte an einem gemeinsamen Beispiel.
 *
 * Nummeriert, weil die Reihenfolge zählt — und als `<ol>`, damit das
 * auch ein Vorleseprogramm erfährt. Die Ziffer daneben ist
 * `aria-hidden`: Sie steht schon in der Listenstruktur.
 */
export function Schritte({
  schritte,
}: {
  schritte: readonly { titel: string; text: string }[];
}) {
  return (
    <ol className="grid gap-8">
      {schritte.map((s, i) => (
        <li key={s.titel} className="grid grid-cols-[auto_1fr] items-start gap-4">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full border border-line font-mono text-[13px] text-ink-3"
          >
            {i + 1}
          </span>
          <div className="grid gap-1.5">
            <h3 className="font-display text-xl font-normal">{s.titel}</h3>
            <p className={`${LESEBREITE} text-[16px] leading-[1.6] text-ink-2`}>{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Aufklappbare Fragen.
 *
 * ── Warum `<details>` und kein eigener Zustand ──────────────────
 *
 * Weil der Browser das kann und es dabei richtig macht: Tastatur,
 * Vorleseprogramm, „im Text suchen" öffnet den passenden Abschnitt.
 * Ein nachgebautes Akkordeon aus `useState` und `div` kostet
 * clientseitiges JavaScript und ist bei jeder dieser drei Sachen
 * schlechter.
 *
 * Alle zu, wenn die Seite kommt. Wer alles offen zeigt, hat keine
 * Vertiefung gebaut, sondern eine lange Seite mit Strichen darin.
 */
export function Aufklapper({
  fragen,
}: {
  fragen: readonly { frage: string; antwort: ReactNode }[];
}) {
  return (
    <div className="grid">
      {fragen.map((f) => (
        <details key={f.frage} className="group border-t border-line last:border-b">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[17px] font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
            {f.frage}
            {/*
              Ein Zeichen, das den Zustand zeigt — und nicht nur eine
              Farbe. Wer Farben nicht unterscheidet, sähe sonst nicht,
              welche Frage offen ist.
            */}
            <span aria-hidden className="shrink-0 text-ink-3 transition-transform group-open:rotate-45">
              <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M8 3v10M3 8h10" />
              </svg>
            </span>
          </summary>
          <div className={`${LESEBREITE} grid gap-3 pb-6 text-[16px] leading-[1.65] text-ink-2`}>
            {f.antwort}
          </div>
        </details>
      ))}
    </div>
  );
}

/**
 * Drei knappe Grundsätze nebeneinander.
 *
 * Kein Kasten, nur eine Linie darüber. Sie sind Aussagen und keine
 * Funktionen — als Karten sähen sie aus wie etwas, das man anklicken
 * kann.
 */
export function Grundsaetze({
  punkte,
}: {
  punkte: readonly { titel: string; text: string }[];
}) {
  return (
    <ul className="grid gap-x-10 gap-y-8 md:grid-cols-3">
      {punkte.map((p) => (
        <li key={p.titel} className="grid content-start gap-2 border-t border-line pt-5">
          <h3 className="text-[17px] font-semibold text-ink">{p.titel}</h3>
          <p className="text-[15px] leading-[1.6] text-ink-2">{p.text}</p>
        </li>
      ))}
    </ul>
  );
}
