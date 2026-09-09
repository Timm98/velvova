"use client";

import { useTransition } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { MAERKTE } from "@paycheck/config";
import { updateSettings } from "@/lib/privacy";

/**
 * Region, Sprache und Währung — als echte Einstellung.
 *
 * ── Warum das kein Anzeigeelement ist ─────────────────────────
 *
 * Ein Länderwähler, der nur die Flagge im Fussbereich ändert, ist die
 * Sorte Gestaltung, die aussieht wie eine Funktion. Diese Auswahl
 * schreibt `jobMarketCountry` und `currency` in die Nutzereinstellungen
 * — dieselben Felder, aus denen die Stellensuche ihr Land nimmt und
 * die Gehaltsanzeige ihre Währung.
 *
 * Nach dem Speichern wird die Seite neu geladen: Die Trefferliste
 * daneben gilt sonst noch für das alte Land, und niemand sähe, dass
 * die Auswahl gewirkt hat.
 *
 * ── Warum nur drei Länder ─────────────────────────────────────
 *
 * Weil es nur für drei Stellen gibt. Die Liste kommt aus `MAERKTE`,
 * derselben Quelle wie die Angaben im Fussbereich; ein viertes Land
 * erscheint hier automatisch, sobald wir dort etwas anzubieten haben.
 */
export function RegionAuswahl({ aktuellesLand,
  className,
}: { aktuellesLand: string;
  className?: string;
}) {
  const router = useRouter();
  const [laeuft, starten] = useTransition();

  return (
    /* `className` von aussen: Der Fuss richtet die drei Spalten über
       `subgrid` aus und braucht dafür einen Griff an dieser Wurzel. */
    <div className={["grid gap-1.5", className].filter(Boolean).join(" ")}>
      <label htmlFor="region" className="text-sm font-semibold text-ink">
        Region &amp; Sprache
      </label>

      {/*
        ══════════════════════════════════════════════════════════
        Dasselbe Feld wie „Darstellung" daneben
        ══════════════════════════════════════════════════════════

        Beide standen im Fuss nebeneinander und sahen verschieden aus:
        dieses gefüllt (`bg-raised`) mit dem Pfeil des Betriebssystems,
        jenes durchsichtig mit Zeichen links und eigenem Pfeil rechts.

        Zwei Felder in einer Zeile, gleich gross, gleiche Aufgabe — und
        trotzdem verschieden gebaut: Das liest sich nicht als
        Unterschied, sondern als Versehen. Und der Systempfeil ist im
        dunklen Blau des Fusses ohnehin kaum zu sehen.

        Jetzt beide gleich: `appearance-none`, durchsichtig, ein
        Zeichen links, ein eigener Pfeil rechts.
      */}
      {/*
        Feld und Erklärung in einem Block.

        Der Fuss richtet seine drei Spalten über `subgrid` aus und legt
        dafür zwei Zeilen an: Überschrift, Bedienelement. Diese Spalte
        hatte drei Kinder — und das dritte landete in derselben Zeile
        wie das zweite und legte sich über das Auswahlfeld.

        Zusammengefasst hat jede Spalte genau zwei Kinder, und die
        Erklärung steht wieder unter dem Feld statt darauf.
      */}
      <div className="grid gap-1.5">
      <div className="relative w-full max-w-[22rem]">
        <Globe
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-2"
          strokeWidth={1.8}
        />
        <select
          id="region"
          defaultValue={aktuellesLand}
          disabled={laeuft}
          onChange={(e) => {
          const markt = MAERKTE.find((m) => m.countryCode === e.target.value);
          if (!markt) return;
          starten(async () => {
            const daten = new FormData();
            daten.set("jobMarketCountry", markt.countryCode);
            daten.set("currency", markt.currency);
            await updateSettings(daten);
            /* Neu laden, damit die Liste daneben nicht für das alte
               Land weitergilt. */
            router.refresh();
          });
        }}
        className="h-11 w-full appearance-none rounded-(--radius-control) border border-line bg-transparent pr-10 pl-9 text-sm text-ink"
        >
          {MAERKTE.map((m) => (
            <option key={m.countryCode} value={m.countryCode}>
              {m.name} · Deutsch · {m.currency}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-2"
          strokeWidth={1.8}
        />
      </div>
      <p className="max-w-[32ch] text-2xs leading-relaxed text-ink-3">
        Bestimmt, in welchem Land gesucht wird, in welcher Währung Gehälter erscheinen und wie
        Datum und Zahlen geschrieben werden.
      </p>
      </div>
    </div>
  );
}
