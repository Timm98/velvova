export * from "./adapter.ts";
export * from "./sources/userImport.ts";
export * from "./registry.ts";
export * from "./sources/arbeitnow.ts";
export * from "./sources/adzuna.ts";
export * from "./sources/careerjet.ts";
/*
 * Namentlich, nicht mit Stern.
 *
 * Jeder Adapter hat ein `zuRawListing` — bei einem Sternexport
 * kollidieren sie. Careerjet war zuerst da und behält den Namen; hier
 * steht, was Nomado24 nach aussen gibt.
 */
export {
  Nomado24Adapter,
  nomado24Adresse,
  arbeitsmodell as nomado24Arbeitsmodell,
  gehalt as nomado24Gehalt,
  zuRawListing as nomado24ZuRawListing,
} from "./sources/nomado24.ts";
export * from "./sources/jooble.ts";
export * from "./ingest.ts";
export * from "./canonical.ts";
export * from "./leistungen.ts";
export * from "./health.ts";
export * from "./sources/ats/board.ts";
export * from "./sources/ats/registrations.ts";
export * from "./sources/partners.ts";
export * from "./sources/lightcast.ts";

/*
 * Die neuen Anbieter benannt statt mit `*`.
 *
 * Jeder bringt eine eigene `zuRawListing` mit — dieselbe Aufgabe, aber
 * je Anbieter ein anderes Antwortformat. Mit `export *` würden drei
 * gleichnamige Funktionen kollidieren, und welche gewinnt, entschiede
 * die Reihenfolge dieser Zeilen. Sie bleiben deshalb intern.
 */
export { JSearchAdapter, type JSearchOptions } from "./sources/jsearch.ts";
export { TheirStackAdapter, type TheirStackOptions } from "./sources/theirstack.ts";
export { BrightDataAdapter, type BrightDataOptions } from "./sources/brightdata.ts";
export { ApifyAdapter, type ApifyOptions } from "./sources/apify.ts";
export {
  CoresignalEnrichment,
  SAMMLUNGEN as CORESIGNAL_SAMMLUNGEN,
  type ZugangsBefund,
} from "./sources/coresignal.ts";
export { holJson, envWert, ProviderHttpError } from "./net.ts";

/*
 * Die Web-Discovery-Schicht.
 *
 * Getrennt von den Adaptern, weil sie etwas anderes tut: sie findet
 * heraus, DASS eine Stelle existiert, und darf sie in aller Regel nicht
 * mitnehmen. Alle Anbieter sind standardmässig aus.
 */
export { entdecke, führeZusammen, type DiscoveryProvider, type DiscoveryCandidate } from "./discovery/index.ts";
export {
  BraveSearchDiscoveryProvider,
  DISCOVERY_PROVIDER,
  GoogleSearchDiscoveryProvider,
  aktiveDiscoveryProvider,
} from "./discovery/providers.ts";
export { nutzung, nutzungZuruecksetzen, type Nutzungszahlen } from "./nutzung.ts";
export { anbieterStand, protokolliereStart, type Anbieterstand, type Anbieterzustand } from "./startpruefung.ts";
export * from "./zusammenfuehren.ts";
export * from "./orchestrierung.ts";
export { gehaltAusText, type GehaltAusText } from "./gehalt-aus-text.ts";
export { BundesagenturAdapter, stellenUrl as bundesagenturStellenUrl, type BundesagenturOptions } from "./sources/bundesagentur.ts";
export { LAND_ZU_WAEHRUNG, waehrungAusText, waehrungBestimmen, type Waehrungsbefund, type Waehrungsherkunft } from "./waehrung.ts";
export * from "./berufskennung.ts";
export * from "./anforderungsart.ts";
export * from "./gehaltsbefund.ts";
export * from "./erfahrungsniveau.ts";
export * from "./analyseschluessel.ts";
export * from "./analyse-warteschlange.ts";
export * from "./versandfenster.ts";
export * from "./stellenzeile.ts";
export * from "./suchauftrag/index.ts";
export * from "./geodaten.ts";
export * from "./proaktiv/index.ts";
export * from "./intelligenz/index.ts";
export * from "./sources/ats/smartrecruiters-partner.ts";
