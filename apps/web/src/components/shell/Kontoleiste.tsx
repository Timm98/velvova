"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { kontoGruppen, type KontoBeschriftungen } from "./kontoeintraege";

/**
 * Die Kontonavigation als Leiste links.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum dasselbe wie im Klappmenü
 * ══════════════════════════════════════════════════════════════
 *
 * In der Vorlage stehen links und rechts oben exakt dieselben
 * Einträge, in derselben Reihenfolge, mit derselben Trennlinie. Das
 * ist kein Zufall: Wer das Menü einmal benutzt hat, findet die
 * Leiste ohne zu suchen — und umgekehrt.
 *
 * Beide lesen deshalb aus `kontoGruppen`. Zwei Listen desselben
 * Menüs laufen beim ersten neuen Eintrag auseinander, und dann ist
 * ein Bereich je nach Seite erreichbar oder nicht.
 *
 * ── Warum eine eigene Datei und nicht `SettingsNav` erweitert ──
 *
 * `SettingsNav` führt die elf Einstellungsbereiche. Das ist eine
 * Ebene tiefer als diese Leiste und bleibt es: Die Vorlage kennt
 * diese Ebene nicht, weil dort „Profil" die Einstellungen SIND. Bei
 * uns gibt es beides, und beides in eine Liste zu pressen hiesse,
 * siebzehn gleichrangige Zeilen zu zeigen.
 */
export function Kontoleiste({
  labels,
  assistent,
  onLogout,
  zusatz,
}: {
  /**
   * Nur Zeichenketten über die Grenze.
   *
   * Die Symbole der Einträge sind Komponenten, und Komponenten
   * lassen sich von einer Server- nicht an eine Client-Komponente
   * übergeben — React bricht die Seite dann mit „Da ist etwas
   * schiefgegangen" ab. Genau das ist hier passiert.
   *
   * Die Liste entsteht deshalb HIER, auf der Client-Seite, aus
   * übersetzten Beschriftungen. Dieselbe Regel wie in
   * `Kontobereich`.
   */
  labels: KontoBeschriftungen;
  assistent: string;
  /** Das Abmeldeformular — kommt fertig gestaltet vom Server. */
  onLogout?: React.ReactNode;
  /** Eine weitere Gruppe, z. B. die Einstellungsbereiche. */
  zusatz?: React.ReactNode;
}) {
  const pfad = usePathname();
  const gruppen = kontoGruppen(labels, assistent);

  return (
    <nav aria-label="Konto" className="lg:sticky lg:top-6 lg:self-start">
      {/*
        Auf schmalen Geräten eine rollbare Zeile, ab `lg` die Leiste.
        Zwei Gruppen untereinander zu rollen hiesse, dass die zweite
        hinter dem Rand beginnt und niemand sie findet.
      */}
      {/*
        ══════════════════════════════════════════════════════════
        Kein `display: contents`
        ══════════════════════════════════════════════════════════

        Hier standen `contents` an der Leiste und an jeder Gruppe, um
        die Einträge auf schmalen Geräten in EINE Rollzeile zu
        bekommen.

        `display: contents` nimmt das Element aus dem Layout: Seine
        Kinder werden Kinder des Grosselternteils. Das Grosselternteil
        war hier das zweispaltige Raster der Seite — die Leiste
        besetzte ihre 240er-Spalte nicht mehr, jeder Eintrag wurde ein
        eigenes Rasterfeld über die volle Breite, und der Inhalt lag
        darunter. Genau so sah es aus.

        Jetzt ohne: Die Leiste ist ein gewöhnlicher Block in ihrer
        Spalte. Schmal rollt eine Reihe, ab `lg` steht ein Stapel.
      */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Konto"
        className="scroll-x pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:overflow-visible lg:pb-0"
      >
        <div className="flex gap-1 lg:block">
          {gruppen.map((gruppe, i) => (
            <div
              key={gruppe.titel}
              className={cn("flex gap-1 lg:block", i > 0 && "lg:mt-5 lg:border-t lg:border-line lg:pt-5")}
            >
              {/* Die Linie trennt sichtbar; der Titel ist für Vorlesegeräte. */}
              <h2 className="sr-only">{gruppe.titel}</h2>
              <ul className="flex gap-1 lg:grid lg:gap-0.5">
                {gruppe.eintraege.map((e) => {
                  const aktiv = e.exakt ? pfad === e.href : pfad.startsWith(e.href.split("?")[0]!);
                  const Zeichen = e.icon;
                  return (
                    <li key={e.href} className="shrink-0">
                      <Link
                        href={e.href}
                        aria-current={aktiv ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-(--radius-control) px-4 text-sm transition-colors",
                          aktiv
                            ? "bg-soft font-medium text-ink"
                            : "text-ink-2 hover:bg-soft hover:text-ink",
                        )}
                      >
                        <Zeichen
                          className={cn("size-4 shrink-0", aktiv ? "text-brand" : "text-ink-3")}
                          strokeWidth={1.9}
                        />
                        {e.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {zusatz && (
            <div className="flex gap-1 lg:mt-5 lg:block lg:border-t lg:border-line lg:pt-5">{zusatz}</div>
          )}

          {onLogout && (
            <div className="flex gap-1 lg:mt-5 lg:block lg:border-t lg:border-line lg:pt-5">{onLogout}</div>
          )}
        </div>
      </div>

      {/*
        Der Block am Fuss — dieselbe Stelle wie in der Vorlage, nur
        mit etwas, das es wirklich gibt. Erst ab `lg`: In der
        rollbaren Zeile auf dem Telefon wäre er ein Absatz zwischen
        Knöpfen.
      */}
      <div className="mt-6 hidden border-t border-line pt-5 lg:block">
        <p className="text-xs font-semibold text-ink">Auch wenn du nicht da bist</p>
        <p className="mt-1 max-w-[26ch] text-2xs leading-relaxed text-ink-3">
          Ein Suchauftrag lässt {assistent} über Nacht weitersuchen und meldet nur, was wirklich
          passt.
        </p>
        <Link
          href="/app/jobs#nachts"
          className="mt-1.5 inline-block text-2xs text-accent-text underline underline-offset-[3px]"
        >
          Suchauftrag einrichten
        </Link>
      </div>
    </nav>
  );
}
