import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * §24B: kein Geheimnis im Auslieferungspaket des Browsers.
 *
 * Zwei Prüfungen, weil eine allein nicht reicht:
 *
 *   1. Statisch — liest eine Client-Komponente eine Umgebungsvariable,
 *      die nicht `NEXT_PUBLIC_` heisst? Next.js ersetzt solche Zugriffe
 *      im Client zwar durch `undefined`, aber der Code sagt dann das
 *      Gegenteil von dem, was er tut, und der nächste Mensch macht
 *      daraus versehentlich ein `NEXT_PUBLIC_`.
 *
 *   2. Am gebauten Ergebnis — enthalten die ausgelieferten Bündel
 *      Zeichenketten, die wie Schlüssel aussehen? Das ist die Prüfung,
 *      die zählt, denn sie schaut auf das, was tatsächlich das Haus
 *      verlässt.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(here, "..", "..");
const srcRoot = path.join(webRoot, "src");

function walk(dir: string, exts: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

describe("Geheimnisse im Browserpaket", () => {
  it("liest in Client-Komponenten keine nicht-öffentliche Umgebungsvariable", () => {
    const treffer: string[] = [];

    for (const file of walk(srcRoot, [".tsx", ".ts"])) {
      if (file.includes(".test.")) continue;
      const content = readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/m.test(content)) continue;

      for (const match of content.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
        const name = match[1]!;
        if (name.startsWith("NEXT_PUBLIC_") || name === "NODE_ENV") continue;
        treffer.push(`${path.relative(webRoot, file)}: ${name}`);
      }
    }

    expect(treffer).toEqual([]);
  });

  it("liefert keine schlüsselartigen Zeichenketten an den Browser aus", () => {
    const staticDir = path.join(webRoot, ".next", "static");
    if (!existsSync(staticDir)) {
      // Ohne Build gibt es nichts zu prüfen. Das ist ehrlicher als ein
      // grün leuchtender Test, der nichts angesehen hat.
      expect(existsSync(staticDir), "Kein Build vorhanden — `pnpm build` vor diesem Test").toBe(
        false,
      );
      return;
    }

    const muster: [string, RegExp][] = [
      ["OpenAI-Schlüssel", /\bsk-[A-Za-z0-9_-]{20,}/],
      ["Supabase service_role", /\bservice_role\b/],
      ["JWT mit Nutzlast", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./],
      ["Adzuna-Kennung", /ADZUNA_APP_KEY\s*[:=]\s*["'][^"']+["']/],
      ["Jooble-Schlüssel", /JOOBLE_API_KEY\s*[:=]\s*["'][^"']+["']/],
      ["Datenbank-URL mit Passwort", /postgres(ql)?:\/\/[^:\s"']+:[^@\s"']+@/],
    ];

    const treffer: string[] = [];
    for (const file of walk(staticDir, [".js", ".mjs", ".css", ".json"])) {
      const content = readFileSync(file, "utf8");
      for (const [name, pattern] of muster) {
        if (pattern.test(content)) treffer.push(`${name} in ${path.relative(webRoot, file)}`);
      }
    }

    expect(treffer).toEqual([]);
  });
});
