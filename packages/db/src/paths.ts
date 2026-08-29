import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Relative Pfade aus der Konfiguration (etwa `.data/pglite`) beziehen sich
 * immer auf die Wurzel des Monorepos, nicht auf das gerade aktive
 * Arbeitsverzeichnis. Sonst legt derselbe Befehl je nach Aufrufort eine
 * andere Datenbank an - ein Fehler, der schwer zu bemerken ist.
 *
 * Vorrang hat PAYCHECK_REPO_ROOT. Das ist kein Umweg: der Bundler kann
 * einen aufgeloesten Pfad nicht statisch nachvollziehen und wuerde sonst
 * das gesamte Projekt in die Ausgabe ziehen.
 */

let cachedRoot: string | null = null;

export function repoRoot(): string {
  if (cachedRoot) return cachedRoot;

  const fromEnv = process.env.PAYCHECK_REPO_ROOT;
  if (fromEnv && path.isAbsolute(fromEnv)) {
    cachedRoot = fromEnv;
    return cachedRoot;
  }

  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      cachedRoot = dir;
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  cachedRoot = process.cwd();
  return cachedRoot;
}

/** Loest einen Pfad gegen die Repo-Wurzel auf und legt ihn bei Bedarf an. */
export function resolveDataDir(configured: string): string {
  const abs = path.isAbsolute(configured)
    ? configured
    : path.join(/* turbopackIgnore: true */ repoRoot(), configured);
  mkdirSync(abs, { recursive: true });
  return abs;
}
