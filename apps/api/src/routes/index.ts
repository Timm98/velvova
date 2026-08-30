import type { FastifyInstance } from "fastify";
import { loadRuntimeConfig, brand, integrationStatus } from "@paycheck/config";
import { SCORING_VERSION } from "@paycheck/domain";
import { DEFAULT_FIT_WEIGHTS, DEFAULT_RANKING_WEIGHTS } from "@paycheck/matching";
import { getDb } from "@paycheck/db";
import { sql } from "drizzle-orm";

/**
 * Die oeffentlichen Endpunkte.
 *
 * Bewusst schmal gehalten: Zustand, Methodik und Gesundheit. Alles, was
 * Nutzerdaten beruehrt, verlangt Authentifizierung und liegt hinter
 * denselben Regeln wie die Weboberflaeche - inklusive der
 * eingeschraenkten Datenbankrolle.
 */
export function registerRoutes(app: FastifyInstance): void {
  const cfg = loadRuntimeConfig();

  app.get("/health", async () => {
    let dbOk = false;
    let dbError: string | null = null;
    try {
      const db = await getDb(cfg);
      await db.execute(sql`SELECT 1`);
      dbOk = true;
    } catch (e) {
      dbError = e instanceof Error ? e.message : "unbekannter Fehler";
    }

    return {
      status: dbOk ? "ok" : "degraded",
      datenbank: { erreichbar: dbOk, treiber: cfg.db.driver, fehler: dbError },
      modus: cfg.mode,
    };
  });

  /**
   * Ehrlicher Zustand der Anbindungen. Genau das, was die Oberflaeche
   * anzeigt - damit eine native App dieselbe Wahrheit bekommt.
   */
  app.get("/status/integrations", async () => {
    const status = integrationStatus(cfg);
    return {
      marke: { name: brand.name, assistenz: brand.assistantName },
      modus: cfg.mode,
      ki: {
        zustand: status.ai,
        hinweis:
          status.ai === "not-connected"
            ? "Kein Anbieter eingerichtet. Nina antwortet nicht — es wird nichts erfunden."
            : "Anbieter verbunden. Texte werden dorthin uebermittelt.",
      },
      email: {
        zustand: status.mail,
        hinweis:
          status.mail === "draft-only"
            ? "Kein Postfach verbunden. Bewerbungen werden als Entwurf erzeugt, nie automatisch versendet."
            : "Postfach verbunden. Versand nur nach ausdruecklicher Bestaetigung.",
      },
      speicher: status.storage,
      sprache: status.voice,
      jobquellen: status.jobSources,
      bewertungsquellen: status.reviewSources,
    };
  });

  /** Die Bewertungslogik offenlegen - dieselben Werte wie /methodology. */
  app.get("/methodology", async () => ({
    fassung: SCORING_VERSION,
    grundsatz:
      "Unbekanntes ist neutral: ein Faktor ohne Daten wird nicht als null gewertet, sondern sein " +
      "Gewicht auf die bekannten verteilt. Das Fehlen senkt ausschliesslich die Sicherheit.",
    keineEinstellungswahrscheinlichkeit:
      "Keiner dieser Werte sagt etwas darueber aus, wie wahrscheinlich eine Einstellung ist.",
    fitGewichte: DEFAULT_FIT_WEIGHTS,
    rankingGewichte: DEFAULT_RANKING_WEIGHTS,
    grenzen: [
      "Der Abgleich zwischen Anforderung und Erfahrung arbeitet mit Wortueberlappung.",
      "Reisezeiten werden geschaetzt, nicht mit einem Routendienst berechnet.",
      "Es hat keine externe wissenschaftliche Validierung stattgefunden.",
    ],
  }));

  app.setNotFoundHandler(async (req, reply) => {
    reply.code(404);
    return { fehler: "Nicht gefunden", pfad: req.url };
  });
}
