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
  /**
   * Wohin der Build schreibt — und warum das einstellbar sein muss.
   *
   * `next dev` und `next build` benutzen beide `.next`. Solange nur
   * eines von beidem läuft, fällt das nie auf. Läuft ein Dev-Server und
   * jemand baut nebenher für eine Messung, überschreibt der Build die
   * gemeinsamen Manifeste — und der Dev-Server liefert danach Seiten
   * aus, die auf Chunks zeigen, die er selbst nicht kennt.
   *
   * Das Ergebnis ist bösartig, weil es nicht nach einem Build-Problem
   * aussieht: das CSS kommt als 404 zurück, ein Chunk lässt sich nicht
   * laden, der Client wirft — und die Person sieht „Da ist etwas
   * schiefgegangen". Gesucht wird dann im Anwendungscode, wo nichts
   * kaputt ist.
   *
   * Mit `NEXT_DIST_DIR` bekommt jeder Build sein eigenes Verzeichnis.
   * Der Dev-Server behält `.next` für sich, und die Kollision ist nicht
   * mehr möglich — nicht seltener, sondern ausgeschlossen.
   */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

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

  /**
   * Kurzadressen, die Menschen tatsächlich eintippen.
   *
   * Die Einstellungen liegen unter `/app/settings`, weil sie zur
   * angemeldeten Anwendung gehören. Getippt wird aber `/settings` — das
   * ist die Adresse, die man erwartet, und sie lieferte eine 404.
   *
   * Eine 404 auf eine naheliegende Adresse ist kein Grenzfall: sie
   * sieht aus, als sei die Seite kaputt, und niemand probiert danach
   * den längeren Pfad. Die Weiterleitung ist dauerhaft (308), damit
   * Lesezeichen und Browserverlauf sie übernehmen.
   */
  async redirects() {
    return [
      { source: "/settings", destination: "/app/settings", permanent: true },
      { source: "/settings/:pfad*", destination: "/app/settings/:pfad*", permanent: true },
      /*
       * `/jobs` leitet nicht mehr um — dort liegt jetzt die
       * öffentliche Stellensuche.
       *
       * Ein Hinweis für später: Diese Weiterleitung war `permanent`,
       * also eine 308. Browser merken sich die unbefristet. Wer
       * `/jobs` vor dieser Änderung aufgerufen hat, landet weiterhin
       * auf `/app/jobs`, bis sein Zwischenspeicher geleert ist — die
       * öffentliche Suche sieht er nicht. Genau deshalb sind
       * dauerhafte Weiterleitungen auf Adressen, die man später noch
       * brauchen könnte, ein schlechtes Geschäft.
       *
       * Für angemeldete Nutzer ist es unkritisch: `/app/jobs` ist die
       * Seite, die sie ohnehin wollen.
       */
      /*
       * `/app` ist keine Seite mehr.
       *
       * Dort lag „Heute" — ein Dashboard, das für Angemeldete eine
       * zweite Startseite war. Es gibt jetzt eine Startseite; wer
       * angemeldet ist, sieht dort seinen Namen über der Zahl.
       *
       * Die Weiterleitung steht hier und nicht als `redirect()` in
       * einer Seite: Über der Seite liegt `app/layout.tsx` mit
       * `requireUser()`. Ein Abgemeldeter wäre also erst auf die
       * Anmeldung geschickt worden, um danach auf einer öffentlichen
       * Seite zu landen. Eine Weiterleitung in der Konfiguration
       * greift vor der Anmeldung.
       *
       * `permanent: false` — eine 308 auf `/app` merkt sich der
       * Browser unbefristet, und diese Adresse könnte später wieder
       * gebraucht werden. Genau der Fehler, der oben bei `/jobs`
       * schon einmal gemacht wurde.
       *
       * Nur die Wurzel: `/app/monday`, `/app/jobs` und die übrigen
       * Unterseiten bleiben unberührt.
       */
      { source: "/app", destination: "/", permanent: false },
      { source: "/nina", destination: "/app/monday", permanent: true },
      { source: "/profile", destination: "/app/profile", permanent: true },
      { source: "/applications", destination: "/app/applications", permanent: true },
    ];
  },

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
      {
        /*
         * Das 3D-Modell ist 12,4 MB und ändert sich nie ohne neuen
         * Dateinamen.
         *
         * Ohne diesen Kopf fragt der Browser bei jeder Vollnavigation
         * neu an — bestenfalls mit 304, schlechtestenfalls mit dem
         * ganzen Download. Ein Jahr `immutable` ist hier richtig: soll
         * eine neue Monday kommen, bekommt sie einen neuen Namen.
         */
        source: "/models/:datei*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default config;
