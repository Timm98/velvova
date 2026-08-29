import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Relative Pfade aus der Konfiguration (etwa `.data/pglite`) beziehen sich
 * immer auf die Wurzel des Monorepos, nicht auf das gerade aktive
 * Arbeitsverzeichnis. Sonst legt derselbe Befehl je nach Aufrufort eine
 * andere Datenbank an - ein Fehler, der schwer zu bemerken ist.
 */

export function repoRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/** Loest einen Pfad gegen die Repo-Wurzel auf und legt ihn bei Bedarf an. */
export function resolveDataDir(configured: string): string {
  const abs = path.isAbsolute(configured) ? configured : path.join(repoRoot(), configured);
  mkdirSync(abs, { recursive: true });
  return abs;
}
