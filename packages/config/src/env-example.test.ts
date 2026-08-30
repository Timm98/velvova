import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Jede Variable in `.env.example` muss irgendwo gelesen werden.
 *
 * Der Anlass: das Beispiel dokumentierte `OPENAI_MODEL_DEFAULT`,
 * gelesen wurde `OPENAI_MODEL_INTERACTIVE`. Wer dem Beispiel folgte,
 * setzte eine Variable, die niemand las — und bekam stillschweigend
 * den Standardwert. Kein Fehler, keine Warnung, nur ein anderes Modell
 * als beabsichtigt.
 *
 * Die Gegenrichtung wird ebenfalls geprüft: eine Variable, die der Code
 * liest, aber niemand dokumentiert, findet beim Aufsetzen niemand.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..", "..");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".data", ".git", "dist", "docs"].includes(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|mjs)$/.test(entry) && !entry.includes(".test.")) out.push(full);
  }
  return out;
}

const quelltext = walk(repoRoot)
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

const beispiel = readFileSync(path.join(repoRoot, ".env.example"), "utf8");
const dokumentiert = [...beispiel.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]!);

/**
 * Variablen, die absichtlich nur dokumentiert sind.
 *
 * Beobachtbarkeit wird von den Bibliotheken selbst gelesen, nicht von
 * unserem Code. Ohne diese Ausnahme müsste man sie aus dem Beispiel
 * streichen — und dann wüsste niemand mehr, dass es sie gibt.
 */
const NUR_DOKUMENTIERT = new Set(["SENTRY_DSN", "POSTHOG_KEY"]);

describe(".env.example", () => {
  it("dokumentiert keine Variable, die niemand liest", () => {
    const tote = dokumentiert.filter(
      (name) => !NUR_DOKUMENTIERT.has(name) && !quelltext.includes(name),
    );
    expect(tote).toEqual([]);
  });

  it("enthält keine Werte, nur Platzhalter", () => {
    // Ein versehentlich eingetragener echter Wert wäre hier
    // versioniert — und damit veröffentlicht.
    const verdaechtig = [...beispiel.matchAll(/^([A-Z][A-Z0-9_]*)=(.+)$/gm)]
      .filter(([, , wert]) => /^(sk-|eyJ|[A-Za-z0-9+/]{32,}=*$)/.test(wert!.trim()))
      .map(([, name]) => name!);
    expect(verdaechtig).toEqual([]);
  });

  it("führt jeden Schlüsselnamen ohne Wert", () => {
    // Nicht-geheime Vorgaben (Modellnamen, Standardwerte) dürfen einen
    // Wert haben. Alles, was nach Geheimnis klingt, nicht.
    const geheim = dokumentiert.filter((n) => /KEY|SECRET|TOKEN|PASSWORD|DSN/.test(n));
    for (const name of geheim) {
      const zeile = beispiel.match(new RegExp(`^${name}=(.*)$`, "m"));
      expect(zeile?.[1] ?? "", name).toBe("");
    }
  });
});
