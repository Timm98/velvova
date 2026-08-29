import { rm } from "node:fs/promises";
import { loadRuntimeConfig } from "@paycheck/config";
import { resolveDataDir } from "./paths.ts";

/**
 * Setzt ausschließlich die lokale Entwicklungsdatenbank zurück. Gegen
 * einen echten Postgres-Server verweigert der Befehl den Dienst - ein
 * versehentliches Leeren einer Serverdatenbank wäre nicht umkehrbar.
 */
const cfg = loadRuntimeConfig();

if (cfg.db.driver !== "pglite") {
  console.error(
    "Abbruch: reset loescht nur die lokale PGlite-Datenbank. " +
      `Aktueller Treiber ist "${cfg.db.driver}". Für einen Server bitte bewusst per Hand vorgehen.`,
  );
  process.exit(1);
}

const dir = resolveDataDir(cfg.db.pgliteDataDir);
await rm(dir, { recursive: true, force: true });
console.log(`Lokale Datenbank gelöscht: `);
console.log("Nächster Schritt: pnpm db:migrate && pnpm db:seed");
