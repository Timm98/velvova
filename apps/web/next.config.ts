import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

/**
 * Die Umgebungsdateien liegen in der Wurzel des Monorepos, nicht neben
 * dieser App — eine Konfiguration für alle Teile. Next sucht sie
 * standardmässig neben der App, deshalb werden sie hier ausdrücklich
 * gelesen.
 *
 * Die Reihenfolge ist die von Next.js, und sie ist wichtig:
 *
 *   1. Was schon in der Umgebung steht, gewinnt immer. So kann ein
 *      Deployment die Dateien überstimmen.
 *   2. `.env.local` schlägt `.env`. Dort stehen die persönlichen Werte.
 *   3. `.env` ist der gemeinsame Grundstock.
 *
 * Die erste Fassung las **nur** `.env`. Damit lief die eigene
 * Setup-Anleitung ins Leere: wer wie dokumentiert eine `.env.local`
 * anlegte, änderte nichts — und nichts schlug fehl, es blieb einfach
 * beim alten Wert. Genau die Sorte Fehler, die einen Nachmittag kostet.
 */
const repoRoot = path.resolve(process.cwd(), "../..");

function loadEnvFile(file: string, overrideFromFile: Set<string>): void {
  let inhalt: string;
  try {
    inhalt = readFileSync(path.join(repoRoot, file), "utf8");
  } catch {
    // Datei fehlt: gültiger Zustand, kein Fehler. Ohne .env läuft das
    // Projekt mit den Standardwerten im Demo-Modus.
    return;
  }

  for (const line of inhalt.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(trimmed);
    if (!match) continue;

    const [, name, rohwert] = match;
    // Aus der echten Umgebung gesetzte Werte bleiben unangetastet —
    // ausser sie stammen aus einer zuvor gelesenen Datei niedrigeren
    // Rangs.
    if (process.env[name!] !== undefined && !overrideFromFile.has(name!)) continue;
    process.env[name!] = rohwert!.replace(/^["']|["']$/g, "");
  }
}

// `.env` zuerst, dann `.env.local` darüber. Die zweite Menge merkt sich,
// welche Namen aus einer Datei stammen und deshalb überschrieben werden
// dürfen.
const ausDatei = new Set<string>();
const vorher = new Set(Object.keys(process.env));
loadEnvFile(".env", ausDatei);
for (const name of Object.keys(process.env)) {
  if (!vorher.has(name)) ausDatei.add(name);
}
loadEnvFile(".env.local", ausDatei);
process.env.PAYCHECK_REPO_ROOT ??= repoRoot;

const config: NextConfig = {
  // Die Workspace-Pakete werden als TypeScript-Quelle eingebunden, nicht
  // als gebauter Code. Das haelt den Entwicklungsweg kurz.
  transpilePackages: [
    "@paycheck/ai", "@paycheck/config", "@paycheck/db", "@paycheck/design-tokens",
    "@paycheck/documents", "@paycheck/domain", "@paycheck/i18n", "@paycheck/jobs",
    "@paycheck/matching",
  ],
  serverExternalPackages: ["@electric-sql/pglite", "pg"],

  /**
   * Next blockiert im Entwicklungsmodus Ressourcen, die von einem anderen
   * Host als dem Bindungshost angefragt werden. Der Server bindet an
   * localhost; wer 127.0.0.1 in die Adresszeile tippt, bekaeme sonst 403
   * auf jedes Skript - und damit eine Seite ohne Interaktivitaet.
   * Gilt ausschliesslich fuer die lokale Entwicklung.
   */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  typedRoutes: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
          // Die Content-Security-Policy setzt die Middleware, weil sie
          // je Anfrage eine Nonce braucht. Siehe src/middleware.ts.
        ],
      },
    ];
  },
};

export default config;
