"use client";

import { useTransition } from "react";
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
export function RegionAuswahl({ aktuellesLand }: { aktuellesLand: string }) {
  const router = useRouter();
  const [laeuft, starten] = useTransition();

  return (
    <div className="grid gap-1.5">
      <label htmlFor="region" className="text-sm font-semibold text-ink">
        Region &amp; Sprache
      </label>
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
        className="h-11 w-full max-w-[22rem] rounded-(--radius-control) border border-line bg-raised px-3 text-sm text-ink"
      >
        {MAERKTE.map((m) => (
          <option key={m.countryCode} value={m.countryCode}>
            {m.name} · Deutsch · {m.currency}
          </option>
        ))}
      </select>
      <p className="max-w-[32ch] text-2xs leading-relaxed text-ink-3">
        Bestimmt, in welchem Land gesucht wird, in welcher Währung Gehälter erscheinen und wie
        Datum und Zahlen geschrieben werden.
      </p>
    </div>
  );
}
