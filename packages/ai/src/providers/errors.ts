/**
 * Fehlertypen der Anbieter — ohne deren SDKs.
 *
 * Diese Datei existiert wegen einer Zeile in `index.ts`:
 *
 *     export { OpenAiConfigurationError } from "./providers/openai.ts";
 *
 * Ein statischer Re-Export zieht die gesamte Datei in den Modulgraph —
 * und damit `import OpenAI from "openai"` in **jedes** Modul, das
 * `@paycheck/ai` anfasst. Der Anbieter wird zwar erst später über
 * `await import(...)` erzeugt, aber sein SDK ist da längst geladen.
 *
 * Das kostet Startzeit auf jeder Serverantwort und macht die Trennung
 * zwischen "konfiguriert" und "nicht konfiguriert" wertlos: eine
 * Installation ohne Schlüssel lädt trotzdem den ganzen Anbietercode.
 *
 * Die Fehlerklassen haben keine Abhängigkeiten. Sie gehören hierher.
 */

export class OpenAiConfigurationError extends Error {
  readonly model: string;

  constructor(model: string, detail: string) {
    super(
      `Das Modell "${model}" ist mit diesem Zugang nicht verfügbar: ${detail} ` +
        `Trage in OPENAI_PRIMARY_MODEL einen Modellnamen ein, den dein Konto nutzen darf. ` +
        `Es wird bewusst keine Ersatzantwort erzeugt.`,
    );
    this.name = "OpenAiConfigurationError";
    this.model = model;
  }
}
