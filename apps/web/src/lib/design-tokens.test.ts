import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Jede benutzte Gestaltungsvariable muss auch definiert sein.
 *
 * Der Anlass für diesen Test war ein Fehler, den niemand gemeldet hat
 * und der trotzdem auf achtzehn Seiten sichtbar war: die Umstellung auf
 * die neue Farbvokabel hat `--accent`, `--positive` und `--space-4`
 * entfernt, während Inline-Stile sie weiter benutzten.
 *
 * CSS verwirft eine Deklaration mit unbekannter Variable stillschweigend.
 * Kein Übersetzungsfehler, keine Warnung im Browser, kein fehlgeschlagener
 * Test — die Abstände fallen einfach zusammen und die Farbe wird geerbt.
 * Genau diese Klasse von Fehlern ist der Grund, warum es diesen Test gibt.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.join(here, "..");
const repoRoot = path.join(webSrc, "..", "..", "..");

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

const definitionSources = [
  path.join(repoRoot, "packages", "design-tokens", "src", "tokens.css"),
  path.join(webSrc, "app", "globals.css"),
];

const defined = new Set<string>();
for (const file of definitionSources) {
  const css = readFileSync(file, "utf8");
  for (const match of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)) defined.add(match[1]!);
}

/**
 * Vom `geist`-Paket gesetzt, nicht von uns. Beide stehen in einer
 * Schriftliste mit echtem Rückfall dahinter — fällt die Variable aus,
 * greift "Inter Tight" beziehungsweise die Systemschrift. Deshalb ist
 * das hier eine bewusste Ausnahme und kein Loch im Test.
 */
const EXTERN_DEFINIERT = ["--font-geist-sans", "--font-geist-mono"];
for (const name of EXTERN_DEFINIERT) defined.add(name);

// `next/font` setzt seine Variablen zur Laufzeit über eine Klasse am
// <html>-Element. Sie stehen deshalb in keiner CSS-Datei, sind aber
// sehr wohl definiert — die Deklaration steht in der Schriftkonfiguration.
for (const file of walk(webSrc, [".ts", ".tsx"])) {
  for (const match of readFileSync(file, "utf8").matchAll(/variable:\s*"(--[a-z0-9-]+)"/g)) {
    defined.add(match[1]!);
  }
}

describe("Gestaltungsvariablen", () => {
  it("definiert jede Variable, die irgendwo benutzt wird", () => {
    const missing = new Map<string, string[]>();

    for (const file of walk(webSrc, [".tsx", ".ts", ".css"])) {
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
      const content = readFileSync(file, "utf8");

      for (const match of content.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
        const name = match[1]!;
        // Mit Rückfallwert ist die Verwendung abgesichert; ohne nicht.
        const withFallback = new RegExp(`var\\(\\s*${name}\\s*,`).test(content);
        if (defined.has(name) || withFallback) continue;
        const list = missing.get(name) ?? [];
        list.push(path.relative(repoRoot, file));
        missing.set(name, list);
      }
    }

    expect(
      Object.fromEntries([...missing].map(([k, v]) => [k, [...new Set(v)].slice(0, 3)])),
    ).toEqual({});
  });

  it("hält beide Themen bei denselben Variablennamen", () => {
    const css = readFileSync(definitionSources[0]!, "utf8");

    const blockNames = (pattern: RegExp) => {
      const block = css.match(pattern)?.[1] ?? "";
      return new Set([...block.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]!));
    };

    const hell = blockNames(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/);
    const dunkel = blockNames(/^:root \{([\s\S]*?)\n\}/m);

    // Die helle Fassung darf weniger definieren — sie erbt den Rest.
    // Was sie aber definiert, muss es in der dunklen auch geben, sonst
    // existiert eine Farbe nur in einem Thema.
    const nurHell = [...hell].filter((name) => !dunkel.has(name));
    expect(nurHell).toEqual([]);
  });
});
