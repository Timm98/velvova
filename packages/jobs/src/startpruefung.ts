import { loadRuntimeConfig, type RuntimeConfig } from "@paycheck/config";
import { decideForProvider, isAllowed } from "@paycheck/sources";
import { sourceStatuses } from "./registry.ts";
import { CoresignalEnrichment } from "./sources/coresignal.ts";
import { ApifyAdapter } from "./sources/apify.ts";
import { BrightDataAdapter } from "./sources/brightdata.ts";

/**
 * Welche Anbieter beim Start einsatzbereit sind.
 *
 * ── Warum das ohne Netzzugriff auskommt ───────────────────────
 *
 * Die Prüfung liest Konfiguration, sie fragt niemanden. Beim Start
 * fünf Anbieter anzupingen hiesse: der Server braucht zum Hochfahren
 * fremde Dienste, und ein langsamer Anbieter verzögert jeden Neustart.
 * Ob ein Anbieter WIRKLICH antwortet, beantwortet der Rauchtest
 * (`scripts/provider-smoketest.mjs`) und die Betriebsansicht.
 *
 * Hier steht nur, was ohne fremde Hilfe entscheidbar ist: liegen die
 * Zugangsdaten vor, ist die Quelle lizenziert, ist sie freigeschaltet.
 * Das ist genau die Frage, die jemand hat, der eben einen Schlüssel
 * eingetragen hat.
 */

export type Anbieterzustand = "active" | "missing credentials" | "not allowed" | "disabled";

export interface Anbieterstand {
  name: string;
  zustand: Anbieterzustand;
  hinweis: string | null;
}

export function anbieterStand(cfg: RuntimeConfig = loadRuntimeConfig()): Anbieterstand[] {
  const stand: Anbieterstand[] = [];

  /*
   * Die Jobquellen kommen aus derselben Funktion, die auch der
   * Abrufpfad benutzt.
   *
   * Eine eigene Liste hier wäre eine zweite Wahrheit — und die
   * Betriebsansicht würde „active" melden, während der Abruf die Quelle
   * überspringt. Genau diese Sorte Abweichung ist der Grund, warum
   * Berichten nicht zu trauen war.
   */
  for (const s of sourceStatuses(cfg)) {
    if (s.key === "seed") continue;

    /*
     * Zugangsdaten UND Freigabe.
     *
     * Hier stand nur die erste Frage, und die Anzeige widersprach
     * daraufhin dem Importlauf: TheirStack und JSearch meldeten
     * „active", während der Abruf sie mit „Rechtsprüfung offen"
     * übersprang. Zwei Auskünfte über dieselbe Sache, und die
     * bequemere war die falsche.
     *
     * Das Quellenverzeichnis entscheidet, ob wir abrufen DÜRFEN. Eine
     * Statusanzeige, die das übergeht, ist nicht optimistisch, sondern
     * unbrauchbar — man müsste sie jedes Mal gegen den echten Lauf
     * prüfen.
     */
    const entscheidung = decideForProvider(s.key);
    const darfSuchen = isAllowed(entscheidung, "Search");

    stand.push({
      name: s.displayName,
      zustand: !darfSuchen
        ? "not allowed"
        : s.active
          ? "active"
          : s.reason === "Zugangsdaten fehlen"
            ? "missing credentials"
            : s.reason.startsWith("gesperrt")
              ? "not allowed"
              : "disabled",
      hinweis: !darfSuchen ? entscheidung.reason : s.active ? null : s.reason,
    });
  }

  // Apify: gesperrte Actors sind eine eigene Aussage, kein fehlender Schlüssel.
  const apify = new ApifyAdapter();
  const gesperrt = apify.gesperrteActors();
  if (gesperrt.length > 0) {
    const zeile = stand.find((z) => z.name === "Apify");
    if (zeile) {
      zeile.zustand = "not allowed";
      zeile.hinweis =
        `Eingetragen, aber gesperrt: ${gesperrt.map((g) => `${g.actor} → ${g.ziel}`).join(", ")}. ` +
        `Das automatisierte Auslesen dieser Portale ist untersagt.`;
    }
  }

  // Bright Data: Schlüssel ohne freigegebenen Datensatz ist ein eigener Fall.
  const bright = new BrightDataAdapter();
  if (bright.hatSchluessel() && !bright.isConfigured()) {
    const zeile = stand.find((z) => z.name === "Bright Data");
    if (zeile) {
      zeile.zustand = "disabled";
      zeile.hinweis = bright.datensatzPlausibel()
        ? "Schlüssel vorhanden, BRIGHT_DATA_DATASET_ID fehlt."
        : "BRIGHT_DATA_DATASET_ID sieht nicht wie eine Dataset-Kennung aus — die beginnen mit \"gd_\". Steht dort versehentlich der API-Schlüssel?";
    }
  }

  // Coresignal ist keine Jobquelle und steht deshalb nicht in der Registry.
  const cs = new CoresignalEnrichment();
  stand.push({
    name: "Coresignal (Enrichment)",
    zustand: cs.isConfigured() ? "active" : "missing credentials",
    hinweis: cs.isConfigured() ? null : "CORESIGNAL_API_KEY fehlt",
  });

  return stand;
}

/**
 * Einmal beim Start in die Serverausgabe.
 *
 * Bewusst als Zeilen und nicht als eine Zusammenfassung: „3 von 9
 * aktiv" beantwortet nicht die Frage, welche drei — und genau die hat
 * jemand, der gerade einen Schlüssel eingetragen hat.
 */
export function protokolliereStart(cfg?: RuntimeConfig): void {
  const stand = anbieterStand(cfg);
  const aktiv = stand.filter((s) => s.zustand === "active").length;
  console.info(`[jobquellen] ${aktiv}/${stand.length} einsatzbereit`);
  for (const s of stand) {
    console.info(`[jobquellen]   ${s.name}: ${s.zustand}${s.hinweis ? ` — ${s.hinweis}` : ""}`);
  }
}
