export * from "./adapter.ts";
export * from "./sources/userImport.ts";
export * from "./registry.ts";
export * from "./sources/arbeitnow.ts";
export * from "./sources/adzuna.ts";
export * from "./sources/jooble.ts";
export * from "./ingest.ts";
export * from "./canonical.ts";
export * from "./health.ts";
export * from "./sources/ats/board.ts";
export * from "./sources/ats/registrations.ts";
export * from "./sources/partners.ts";
export * from "./sources/lightcast.ts";

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
