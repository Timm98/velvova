import { z } from "zod";

/**
 * Der API-Vertrag.
 *
 * Ein Schema je Endpunkt, aus dem sowohl die Laufzeitpruefung als auch
 * die OpenAPI-Beschreibung entsteht. Zwei getrennte Quellen - ein
 * handgeschriebenes OpenAPI-Dokument neben handgeschriebenen Typen -
 * laufen zuverlaessig auseinander, und der Bruch faellt erst beim
 * Konsumenten auf.
 */

export const ErrorResponse = z.object({
  fehler: z.string(),
  feld: z.string().optional(),
});

export const HealthResponse = z.object({
  status: z.enum(["ok", "degraded"]),
  datenbank: z.object({
    erreichbar: z.boolean(),
    treiber: z.enum(["pglite", "pg"]),
    fehler: z.string().nullable(),
  }),
  modus: z.enum(["demo", "live"]),
});

export const IntegrationStatusResponse = z.object({
  marke: z.object({ name: z.string(), assistenz: z.string() }),
  modus: z.enum(["demo", "live"]),
  ki: z.object({ zustand: z.enum(["connected", "not-connected"]), hinweis: z.string() }),
  email: z.object({
    zustand: z.enum(["connected", "draft-only", "not-connected"]),
    hinweis: z.string(),
  }),
  speicher: z.enum(["connected", "local"]),
  sprache: z.enum(["connected", "dictation-only", "not-connected"]),
  jobquellen: z.array(z.string()),
  bewertungsquellen: z.array(z.string()),
});

export const MethodologyResponse = z.object({
  fassung: z.string(),
  grundsatz: z.string(),
  keineEinstellungswahrscheinlichkeit: z.string(),
  fitGewichte: z.record(z.string(), z.number()),
  rankingGewichte: z.record(z.string(), z.number()),
  grenzen: z.array(z.string()),
});

export interface RouteContract {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  /** true, wenn eine Anmeldung noetig ist. */
  authenticated: boolean;
  request?: z.ZodType<unknown>;
  response: z.ZodType<unknown>;
}

/**
 * Die heute bedienten Endpunkte. Nutzerbezogene Ressourcen folgen mit
 * der nativen App - sie stehen bewusst noch nicht hier, damit der
 * Vertrag nicht mehr verspricht, als die API haelt.
 */
export const ROUTES: RouteContract[] = [
  {
    method: "GET",
    path: "/health",
    summary: "Betriebszustand und Erreichbarkeit der Datenbank",
    authenticated: false,
    response: HealthResponse,
  },
  {
    method: "GET",
    path: "/status/integrations",
    summary: "Ehrlicher Zustand aller Anbindungen",
    authenticated: false,
    response: IntegrationStatusResponse,
  },
  {
    method: "GET",
    path: "/methodology",
    summary: "Die Bewertungslogik mit Gewichten und Grenzen",
    authenticated: false,
    response: MethodologyResponse,
  },
];

/** Erzeugt eine OpenAPI-Beschreibung aus denselben Schemata. */
export function toOpenApi(brandName = "Paycheck"): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of ROUTES) {
    const entry = {
      summary: route.summary,
      security: route.authenticated ? [{ sessionCookie: [] }] : [],
      responses: {
        "200": {
          description: "Erfolg",
          content: { "application/json": { schema: z.toJSONSchema(route.response, { target: "draft-7" }) } },
        },
        "404": {
          description: "Nicht gefunden",
          content: { "application/json": { schema: z.toJSONSchema(ErrorResponse, { target: "draft-7" }) } },
        },
      },
    };
    paths[route.path] = { ...(paths[route.path] ?? {}), [route.method.toLowerCase()]: entry };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: `${brandName} API`,
      version: "0.1.0",
      description:
        "Die typisierte API fuer die native App und spaetere Partner. Sie nutzt dieselben " +
        "Pakete wie die Weboberflaeche; es gibt keine zweite Fachlogik.",
    },
    components: {
      securitySchemes: {
        sessionCookie: { type: "apiKey", in: "cookie", name: "paycheck_session" },
      },
    },
    paths,
  };
}
