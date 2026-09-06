/**
 * Quellenschicht.
 *
 * Eigenes Paket, weil der rechtliche Riegel sonst umgehbar bleibt:
 * solange die Policy Engine in der Weboberfläche lag, musste jeder
 * Aufrufer sie von sich aus mitgeben. Ein vergessener Parameter war ein
 * stiller Abruf ohne Freigabe.
 *
 * Jetzt kann `packages/jobs` selbst fragen, und die Frage ist nicht
 * mehr optional.
 */
export * from "./decision-types.ts";
export * from "./source-registry.ts";
export * from "./policy-engine.ts";
export * from "./provenance.ts";
export * from "./web-discovery.ts";
export * from "./url-safety.ts";
export * from "./brief-policy.ts";
export * from "./link-analyse.ts";
