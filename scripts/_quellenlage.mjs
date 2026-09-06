import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Wer antwortet gerade wie — je Stellenquelle, ohne Schlüssel zu zeigen.
 *
 * Der Importlauf meldet nur „403" oder „402". Das sieht bei allen
 * gleich aus und heisst sehr Verschiedenes: ein abgelaufener
 * Schlüssel, ein leeres Guthaben, oder ein Bot-Schutz, der die Anfrage
 * gar nicht erst durchlässt.
 */
const { activeAdapters } = await import("../packages/jobs/src/registry.ts");
const { loadRuntimeConfig } = await import("../packages/config/src/index.ts");

for (const a of activeAdapters(loadRuntimeConfig())) {
  const t0 = Date.now();
  try {
    const l = await a.fetchListings({ limit: 3 });
    console.log(`  ok    ${a.key.padEnd(22)} ${l.length} Anzeigen · ${Date.now() - t0} ms`);
  } catch (e) {
    const m = String(e instanceof Error ? e.message : e).replace(/\s+/g, " ");
    const grund =
      /cloudflare|<!doctype|<html/i.test(m) ? "Sperrseite (Bot-Schutz), keine Schnittstellenantwort"
      : /402/.test(m) ? "402 — Guthaben aufgebraucht"
      : /401|403/.test(m) ? "401/403 — Zugang abgelehnt"
      : /429/.test(m) ? "429 — Taktgrenze"
      : m.slice(0, 90);
    console.log(`  !!    ${a.key.padEnd(22)} ${grund}`);
  }
}
process.exit(0);
