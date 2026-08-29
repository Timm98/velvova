import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

/**
 * Die .env liegt in der Wurzel des Monorepos, nicht in dieser App - eine
 * Konfiguration fuer alle Teile. Next sucht sie standardmaessig neben der
 * App, deshalb wird sie hier ausdruecklich gelesen. Bereits gesetzte
 * Variablen gewinnen, damit die Umgebung die Datei ueberstimmen kann.
 */
const repoRoot = path.resolve(process.cwd(), "../..");
try {
  for (const line of readFileSync(path.join(repoRoot, ".env"), "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && process.env[match[1]!] === undefined) {
      process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // Keine .env vorhanden: das Projekt laeuft dann mit den Standardwerten
  // im Demo-Modus. Das ist ein gueltiger Zustand, kein Fehler.
}
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
