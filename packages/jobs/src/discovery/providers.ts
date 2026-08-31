import type { DiscoveryProvider } from "./index.ts";

/**
 * Die Discovery-Anbieter. Alle standardmässig aus.
 *
 * Sie sind vorbereitet, nicht aktiv — genau so beauftragt. Jeder von
 * ihnen kostet Geld oder trägt Auflagen, und keiner davon soll durch
 * ein Versehen anlaufen. Deshalb ist die Voreinstellung überall `false`
 * und nicht „an, wenn ein Schlüssel da ist": ein Schlüssel in der
 * Umgebung ist keine Entscheidung, ein gesetzter Schalter schon.
 *
 * Was alle gemeinsam haben: sie liefern Metadaten und Links. Keiner von
 * ihnen ruft die gefundene Seite ab. Ob mit einem Link mehr geschehen
 * darf als das Verlinken, entscheidet allein die Policy.
 */

function schalter(name: string): boolean {
  return process.env[name] === "true";
}

/**
 * Google — über die offizielle Programmable Search API.
 *
 * Ausdrücklich NICHT: die Suchseite abrufen und auswerten. Das wäre
 * Scraping von Google-Ergebnissen und ist untersagt. Die API ist der
 * Weg, den Google dafür vorsieht; sie ist kostenpflichtig und deshalb
 * aus.
 *
 * Für die spätere Umsetzung ist Vertex AI mit „Grounding with Google
 * Search" die bevorzugte Variante, weil sie dieselbe Grundlage hat und
 * die Ergebnisse bereits strukturiert liefert.
 */
export class GoogleSearchDiscoveryProvider implements DiscoveryProvider {
  readonly key = "google_search";
  readonly displayName = "Google Programmable Search";
  readonly grundlage =
    "Offizielle Programmable Search API mit eigenem Schlüssel. Keine Auswertung von Suchergebnisseiten.";

  isEnabled(): boolean {
    return (
      schalter("GOOGLE_SEARCH_DISCOVERY_ENABLED") &&
      Boolean(process.env.GOOGLE_SEARCH_API_KEY) &&
      Boolean(process.env.GOOGLE_SEARCH_ENGINE_ID)
    );
  }

  async suche(
    anfrage: string,
    options: { limit?: number; signal?: AbortSignal } = {},
  ): Promise<{ url: string; title?: string | null }[]> {
    /*
     * Der ausgeschaltete Anbieter gibt nichts zurück, statt zu werfen.
     *
     * Ein Fehler hier würde die Suche der Person abbrechen, obwohl
     * alles in Ordnung ist: dieser Anbieter ist eben nicht bestellt.
     * Die Quellenübersicht zeigt ihn als „nicht verbunden".
     */
    if (!this.isEnabled()) return [];

    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", process.env.GOOGLE_SEARCH_API_KEY!);
    url.searchParams.set("cx", process.env.GOOGLE_SEARCH_ENGINE_ID!);
    url.searchParams.set("q", anfrage);
    url.searchParams.set("num", String(Math.min(options.limit ?? 10, 10)));

    const antwort = await fetch(url, {
      signal: options.signal ?? AbortSignal.timeout(10_000),
    });
    if (!antwort.ok) return [];

    const daten = (await antwort.json()) as {
      items?: { title?: string; link?: string; snippet?: string }[];
    };

    /*
     * Nur Titel und Adresse. Der Anriss aus der Suche bleibt liegen:
     * er stammt aus der fremden Seite, und ihn zu speichern wäre eine
     * Übernahme ohne Grundlage — auch wenn die Suche ihn mitliefert.
     */
    return (daten.items ?? [])
      .filter((i): i is { title: string; link: string } => Boolean(i.title && i.link))
      .map((i) => ({ url: i.link, title: i.title }));
  }
}

/**
 * Brave Search.
 *
 * Vorbereitet und aus. Eine kostenpflichtige Abhängigkeit wird nicht
 * eingebaut, solange niemand sie bestellt hat — der Schalter ist die
 * Bestellung.
 */
export class BraveSearchDiscoveryProvider implements DiscoveryProvider {
  readonly key = "brave_search";
  readonly displayName = "Brave Search API";
  readonly grundlage = "Offizielle Brave Search API mit eigenem Schlüssel.";

  isEnabled(): boolean {
    return schalter("BRAVE_SEARCH_ENABLED") && Boolean(process.env.BRAVE_SEARCH_API_KEY);
  }

  async suche(
    anfrage: string,
    options: { limit?: number; signal?: AbortSignal } = {},
  ): Promise<{ url: string; title?: string | null }[]> {
    if (!this.isEnabled()) return [];

    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", anfrage);
    url.searchParams.set("count", String(Math.min(options.limit ?? 10, 20)));

    const antwort = await fetch(url, {
      headers: {
        accept: "application/json",
        "x-subscription-token": process.env.BRAVE_SEARCH_API_KEY!,
      },
      signal: options.signal ?? AbortSignal.timeout(10_000),
    });
    if (!antwort.ok) return [];

    const daten = (await antwort.json()) as {
      web?: { results?: { title?: string; url?: string; description?: string }[] };
    };

    return (daten.web?.results ?? [])
      .filter((r): r is { title: string; url: string } => Boolean(r.title && r.url))
      .map((r) => ({ url: r.url, title: r.title }));
  }
}

/**
 * Alle Anbieter, in fester Reihenfolge.
 *
 * `aktiveDiscoveryProvider()` gibt zurück, was wirklich läuft — meist
 * nichts. Die Quellenübersicht zeigt die übrigen als vorbereitet und
 * nicht verbunden, statt sie zu verschweigen: eine Suche, die weniger
 * findet als möglich, soll erklärbar sein.
 */
export const DISCOVERY_PROVIDER: DiscoveryProvider[] = [
  new GoogleSearchDiscoveryProvider(),
  new BraveSearchDiscoveryProvider(),
];

export function aktiveDiscoveryProvider(): DiscoveryProvider[] {
  return DISCOVERY_PROVIDER.filter((p) => p.isEnabled());
}
