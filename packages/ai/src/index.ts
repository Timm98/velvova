export * from "./provider.ts";
export * from "./factory.ts";
export * from "./router.ts";
export * from "./guardrails.ts";
export * from "./jsonSchema.ts";
export * from "./preise.ts";
export * from "./syntheserufer.ts";
export * from "./prompts/nina.ts";
export * from "./prompts/suchauftrag.ts";
export * from "./interview.ts";
export * from "./questions.ts";
export * from "./tools.ts";
/* Der lokale Anbieter wird hier bewusst NICHT re-exportiert.
   Tests holen ihn direkt aus "./providers/mock.ts". Über das
   Paket erreichbar zu sein hieße: irgendwann importiert ihn ein
   Produktionspfad, und niemand merkt es. */
// Aus errors.ts, nicht aus openai.ts: ein statischer Re-Export von dort
// zöge das OpenAI-SDK in jedes Modul, das dieses Paket anfasst — auch in
// Installationen ohne Schlüssel, die es nie brauchen.
export { OpenAiConfigurationError } from "./providers/errors.ts";

/* Ninas Gesprächsmaschine: Stufen, Jobreife, strukturierte Ausgabe. */
export * from "./nina/index.ts";
export * from "./dimensionslesen.ts";
export * from "./modelle.ts";
export * from "./modellgesundheit.ts";
export * from "./zweitemeinung.ts";
export * from "./tiefeanalyse.ts";
export * from "./gespraechstiefe.ts";
export * from "./prompts/profilsynthese.ts";
export * from "./prompts/suchdeutung.ts";
export * from "./prompts/karriereanalyse.ts";
