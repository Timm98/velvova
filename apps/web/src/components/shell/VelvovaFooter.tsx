import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { MAERKTE, brand } from "@paycheck/config";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RegionAuswahl } from "./RegionAuswahl";
import { Laenderraster } from "./Laenderraster";
import { Zahlungsarten } from "./Zahlungsarten";
import { AppBadges } from "./AppBadges";
import { SozialeKanaele } from "./SozialeKanaele";
import type { Landzeile } from "@/lib/jobs/laenderbestand";

/**
 * Der Fussbereich.
 *
 * ── Warum er gross sein darf ──────────────────────────────────
 *
 * Er ist die letzte Fläche, auf der jemand nachsieht, ob hinter der
 * Seite etwas steht. Ein Fussbereich mit vier Links sagt: das war's.
 *
 * ── Warum trotzdem nichts erfunden wird ───────────────────────
 *
 * Keine Social-Symbole ohne Konten, keine vierzig Länder ohne Stellen
 * darin. Die Ladenabzeichen stehen da, weil der Betreiber sie gestellt
 * hat — mit dem Satz darunter, dass die App noch kommt. Was es nicht
 * gibt, steht als „kommt bald" da oder gar nicht.
 *
 * Die Märkte kommen aus `MAERKTE` — dieselbe Quelle, aus der die
 * Regionsauswahl und die Währungsformatierung lesen. Eine zweite Liste
 * hier würde beim nächsten Land auseinanderlaufen.
 */

interface Spalte {
  titel: string;
  links: { href: string; label: string }[];
}

const SPALTEN: Spalte[] = [
  {
    titel: "Velvova",
    links: [
      { href: "/app/jobs", label: "Jobs entdecken" },
      { href: "/app/jobs?remote=remote", label: "Remote-Jobs" },
      { href: "/app/beitraege", label: "Karriere-Ratgeber" },
      { href: "/app/tools/gehalt", label: "Gehaltsvergleich" },
      { href: "/app/jobs/vergleich", label: "Jobvergleich" },
    ],
  },
  {
    titel: "Für Bewerber",
    links: [
      { href: "/app/monday", label: "Mit Monday sprechen" },
      { href: "/app/career", label: "Profil" },
      { href: "/app/applications", label: "Bewerbungen" },
      { href: "/app/jobs?gespeichert=1", label: "Gespeicherte Jobs" },
      { href: "/app/belege", label: "Deine Belege" },
    ],
  },
  {
    titel: "Für Unternehmen",
    links: [
      { href: "/for-business", label: "Velvova für Unternehmen" },
      { href: "/business/stellen", label: "Stellen veröffentlichen" },
      { href: "/business/bewerbungen", label: "Bewerbungen verwalten" },
    ],
  },
  {
    titel: "Über Velvova",
    links: [
      { href: "/about", label: "Über uns" },
      { href: "/how-it-works", label: "So funktioniert es" },
      { href: "/reviews", label: "Bewertungen" },
      { href: "/imprint", label: "Impressum" },
    ],
  },
  {
    titel: "Support",
    links: [
      { href: "/security", label: "Sicherheit" },
      { href: "/privacy", label: "Datenschutz" },
      { href: "/terms", label: "AGB" },
      { href: "/app/settings/privacy", label: "Cookie-Einstellungen" },
    ],
  },
];

export function VelvovaFooter({
  land = "DE",
  laender = [],
  angemeldet = false,
}: {
  land?: string;
  /** Märkte mit Stellenzahl. Leer heisst: das Raster entfällt. */
  laender?: Landzeile[];
  /**
   * Steht der Fuss unter einer angemeldeten Sitzung?
   *
   * Nur dafür da, den Aufruf oben links richtig zu beschriften.
   * „Jetzt kostenlos starten" unter jemandem, der längst angemeldet
   * ist, liest sich, als kenne die Seite ihn nicht.
   */
  angemeldet?: boolean;
}) {
  return (
    <footer
      /*
       * Immer dunkelblau, unabhängig vom gewählten Farbschema.
       *
       * `data-theme="dark"` steht hier am Container, nicht an der
       * Wurzel: Damit lösen *alle* Farbtoken darin — Fläche, Schrift,
       * Ränder, Trennlinien — geschlossen die dunkle Palette auf.
       *
       * Der naheliegende Weg wäre gewesen, nur den Hintergrund fest zu
       * setzen. Dann stünde im hellen Modus die helle Textfarbe auf
       * dunklem Grund, und man flickt anschliessend jeder Zeile,
       * jedem Rahmen und jedem Zustand einzeln hinterher. Das Token-
       * System kann genau das, wofür es gebaut ist: einen Teilbaum
       * umschalten.
       */
      data-theme="dark"
      /*
       * Der Fuss ist die abgesetzte Fläche der Vorlage — #1c253a.
       *
       * Die Zahl steht als `--background-subtle` im Kern; `bg-sunken`
       * holt sie sich von dort. `data-theme="dark"` sorgt dafür, dass
       * auch bei heller Einstellung die dunkle Seite gilt: Der Fuss
       * ist in der Vorlage immer blau.
       *
       * Der Eckenradius stand hier ebenfalls, als Ausnahme gegen
       * unsere Pillen. Er ist weg, seit die ganze Skala der Vorlage
       * folgt — eine Ausnahme, die dasselbe sagt wie die Regel, ist
       * nur eine Stelle mehr, die man pflegen muss.
       */
      className="mt-20 bg-sunken"
    >
      <div className="mx-auto w-full max-w-(--breite-inhalt) px-5 py-14 md:py-16">
        {/*
          ══════════════════════════════════════════════════════════
          Reihe 1 — Aufruf, Einstellungen, Darstellung
          ══════════════════════════════════════════════════════════

          Drei gleich breite Spalten, darunter eine Trennlinie. Die
          beiden rechten sind Felder derselben Höhe; links steht ein
          umrandeter Knopf über die volle Spaltenbreite.
        */}
        <div className="grid gap-8 md:grid-cols-3 md:gap-10">
          <div className="grid content-start gap-3">
            <h2 className="text-sm font-semibold text-ink">Monday sucht über Nacht</h2>
            {/*
              Beide Wege enden am selben Kasten auf der Jobseite.

              Vorher führte der Knopf für Nichtangemeldete zur
              Registrierung — eine Zwischenstation, die nicht zeigt,
              wovon die Rede ist. Wer den Kasten sieht und einen
              Suchauftrag anlegen will, wird dort ohnehin nach einem
              Konto gefragt; die Reihenfolge „erst sehen, dann
              anmelden" ist die ehrlichere.
            */}
            <Link
              href="/app/jobs#nachts"
              className="flex h-11 items-center justify-center rounded-(--radius-control) border border-line px-4 text-sm font-medium text-ink transition-colors hover:bg-inset"
            >
              {angemeldet ? "Suchauftrag einrichten" : "Jetzt kostenlos starten"}
            </Link>
          </div>

          <RegionAuswahl aktuellesLand={land} />

          <div className="grid content-start gap-1.5">
            <span className="text-sm font-semibold text-ink">Darstellung</span>
            <ThemeToggle
              feld
              labels={{ light: "Hell", dark: "Dunkel", system: "System", group: "Darstellung" }}
            />
          </div>
        </div>

        {/*
          ══════════════════════════════════════════════════════════
          Reihe 2 — die Verweisspalten
          ══════════════════════════════════════════════════════════

          `content-start` an jeder Spalte — sonst strecken sich die Zeilen.

          Die Spalten stehen als Gitterfelder nebeneinander und werden
          alle so hoch wie die längste. Innerhalb einer Spalte verteilte
          das Gitter diese Höhe auf Überschrift und Liste: Gemessen
          standen die Links in „Velvova" 36 Pixel auseinander, in „Für
          Unternehmen" 48 — und deren erster begann 36 Pixel tiefer.
          Kein Abstandsfehler, sondern gestreckter Leerraum.

          Drei Spalten wie in der Vorlage. Unsere fünf Bereiche laufen
          damit in zwei Reihen, was dem Bild dort entspricht: zwei
          Blöcke zu je drei Spalten.
        */}
        <div className="mt-12 grid gap-x-10 gap-y-12 border-t border-line pt-12 sm:grid-cols-2 md:grid-cols-3">
          {SPALTEN.map((s) => (
            <nav key={s.titel} aria-label={s.titel} className="grid content-start gap-3">
              <h2 className="text-sm font-semibold text-ink">{s.titel}</h2>
              {/*
                * Die Berührungsfläche liegt am Link, nicht am Abstand.
                *
                * Mit `gap-2` war jeder Link etwa zwanzig Pixel hoch —
                * auf dem Telefon zu wenig. Danach standen 44 Pixel
                * hier, und die Spalten liefen weit auseinander: fünf
                * Links füllten eine halbe Bildschirmhöhe.
                *
                * 36 Pixel sind der Mittelweg. Das Mindestmass für
                * Zielgrössen nach WCAG 2.2 AA liegt bei 24; 44 ist die
                * AAA-Stufe. Die Spalten stehen damit dicht beieinander
                * und bleiben mit dem Finger bedienbar.
                */}
              <ul className="grid">
                {s.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="inline-flex min-h-9 items-center text-sm text-ink-2 transition-colors hover:text-ink"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/*
          ══════════════════════════════════════════════════════════
          Reihe 3 — Kontakt, App, Zahlungsarten
          ══════════════════════════════════════════════════════════

          Dieselben drei Spalten, ohne Trennlinie davor: In der Vorlage
          trennt hier nur Abstand, weil es weiter dieselbe Sorte Inhalt
          ist — Auskünfte über den Anbieter.
        */}
        <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 md:grid-cols-3">
          <div className="grid content-start gap-3">
            <h2 className="text-sm font-semibold text-ink">Kontakt</h2>
            {/*
              * Echte Adressen, keine Platzhalter.
              *
              * Eine Support-Adresse, die niemanden erreicht, ist
              * schlimmer als keine: Wer schreibt, wartet auf eine
              * Antwort, die nie kommt.
              */}
            <ul className="grid">
              <li>
                <a
                  href={`mailto:${brand.kontaktEmail}`}
                  className="inline-flex min-h-9 items-center text-sm text-ink-2 hover:text-ink"
                >
                  {brand.kontaktEmail}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${brand.supportEmail}`}
                  className="inline-flex min-h-9 items-center text-sm text-ink-2 hover:text-ink"
                >
                  {brand.supportEmail}
                </a>
              </li>
            </ul>
          </div>

          <AppBadges />

          <Zahlungsarten />
        </div>

        {/*
          * Die Märkte mit Zahl — dieselbe, die die Suche dort zeigt.
          * Ohne Zahlen wären es neunzehn Fähnchen, die Reichweite
          * behaupten; mit Zahlen ist es eine überprüfbare Auskunft.
          */}
        {laender.length > 0 && (
          <div className="mt-14">
            <Laenderraster laender={laender} />
          </div>
        )}

        {/*
          Die Währungen der Märkte — dieselbe Liste, nur mit der
          Angabe, in der dort gerechnet wird. Sie steht unter dem
          Länderraster, weil sie dieselben Länder betrifft; zweimal
          nebeneinander wäre sie eine zweite Länderliste.
        */}
        <div className="mt-8 grid gap-2">
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
            {MAERKTE.slice(0, 5).map((m) => (
              <li key={m.countryCode} className="text-2xs text-ink-3">
                {m.name} · {m.currency}
              </li>
            ))}
          </ul>

          {MAERKTE.length > 5 && (
            /*
             * `<details>` statt eines nachgebauten Aufklappers: von
             * Haus aus tastaturbedienbar, wird von Vorlesegeräten
             * angesagt, funktioniert ohne JavaScript, und der Browser
             * findet den zugeklappten Text bei der Seitensuche.
             */
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-2xs text-accent-text marker:content-none">
                <span className="group-open:hidden">{MAERKTE.length - 5} weitere Märkte</span>
                <span className="hidden group-open:inline">Weniger anzeigen</span>
                <ChevronDown
                  aria-hidden
                  className="size-3.5 transition-transform group-open:rotate-180"
                  strokeWidth={1.8}
                />
              </summary>

              <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
                {MAERKTE.slice(5).map((m) => (
                  <li key={m.countryCode} className="text-2xs text-ink-3">
                    {m.name} · {m.currency}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <p className="text-2xs leading-relaxed text-ink-3">
            Weitere Länder folgen, sobald wir dort Stellen und Referenzdaten haben.
          </p>
        </div>

        {/*
          ══════════════════════════════════════════════════════════
          Fusszeile — Rechtliches links, Kanäle rechts
          ══════════════════════════════════════════════════════════
        */}
        <div className="mt-12 flex flex-wrap items-center gap-x-7 gap-y-4 border-t border-line pt-8 text-2xs text-ink-3">
          <span className="font-semibold text-ink-2">{brand.name}</span>
          <span>© {new Date().getFullYear()} {brand.name}</span>
          <Link href="/imprint" className="inline-flex min-h-9 items-center hover:text-ink">Impressum</Link>
          <Link href="/privacy" className="inline-flex min-h-9 items-center hover:text-ink">Datenschutz</Link>
          <Link href="/terms" className="inline-flex min-h-9 items-center hover:text-ink">AGB</Link>
          <Link href="/app/settings/privacy" className="inline-flex min-h-9 items-center hover:text-ink">
            Cookie-Einstellungen
          </Link>

          {/* Die Kanäle stehen in derselben Zeile wie das Rechtliche:
              beides sind Wege hinaus, keine Wege durch das Produkt.
              Ohne hinterlegte Adresse erscheint hier nichts. */}
          <span className="ml-auto">
            <SozialeKanaele />
          </span>
        </div>
      </div>
    </footer>
  );
}
