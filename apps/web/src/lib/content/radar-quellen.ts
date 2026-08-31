/**
 * Die Quellen des Arbeitswelt-Radars (V7 §23.2).
 *
 * Alles hier sind öffentliche RSS-Feeds offizieller oder
 * institutioneller Herausgeber. Das ist kein Zufall und keine
 * Bequemlichkeit: ein RSS-Feed wird vom Herausgeber ausdrücklich zur
 * Weiterverbreitung veröffentlicht, und genau das — Titel, Datum, Link,
 * die vom Feed selbst gelieferte Kurzbeschreibung — wird übernommen.
 *
 * Was NICHT passiert:
 *
 *   - Kein Volltext. Der Artikel wird nicht geholt, nicht gespeichert,
 *     nicht umformuliert. Ein umgeschriebener fremder Artikel ist keine
 *     eigene Leistung, sondern dieselbe Übernahme mit anderen Wörtern.
 *   - Kein Scraping. Wo kein Feed steht, steht die Quelle nicht hier.
 *   - Keine Umgehung von Bezahlschranken.
 *
 * Der Link führt immer zum Original. Wer liest, liest beim Herausgeber
 * — das ist der Gegenwert für die Nutzung des Feeds.
 */

export interface RadarQuelle {
  id: string;
  name: string;
  /** Warum diese Quelle benutzt werden darf. Steht hier, nicht im Kopf. */
  grundlage: string;
  feed: string;
  themen: RadarThema[];
}

export type RadarThema =
  | "Arbeitsmarkt"
  | "KI und Berufsbilder"
  | "Bewerbung"
  | "Gehalt"
  | "Neue Berufsfelder"
  | "Weiterbildung";

export const RADAR_QUELLEN: RadarQuelle[] = [
  {
    id: "iab-forum",
    name: "IAB-Forum",
    grundlage:
      "Institut für Arbeitsmarkt- und Berufsforschung der Bundesagentur für Arbeit. " +
      "Öffentlicher RSS-Feed, Inhalte überwiegend unter Creative Commons.",
    feed: "https://www.iab-forum.de/feed/",
    themen: ["Arbeitsmarkt", "KI und Berufsbilder", "Neue Berufsfelder"],
  },
  {
    id: "destatis",
    name: "Statistisches Bundesamt",
    grundlage: "Amtliche Statistik, öffentlicher Pressemitteilungs-Feed.",
    feed: "https://www.destatis.de/SiteGlobals/Functions/RSSFeed/DE/RSSNewsfeed_Pressemitteilungen.xml",
    themen: ["Arbeitsmarkt", "Gehalt"],
  },
  {
    id: "bibb",
    name: "Bundesinstitut für Berufsbildung",
    grundlage: "Bundesinstitut, öffentlicher Pressefeed zu Aus- und Weiterbildung.",
    feed: "https://www.bibb.de/dienst/publikationen/de/rss/pressemitteilungen",
    themen: ["Weiterbildung", "Neue Berufsfelder"],
  },
];

/** Welche Themen der Radar abdecken soll (§23.2). */
export const RADAR_THEMEN: RadarThema[] = [
  "Arbeitsmarkt",
  "KI und Berufsbilder",
  "Bewerbung",
  "Gehalt",
  "Neue Berufsfelder",
  "Weiterbildung",
];
