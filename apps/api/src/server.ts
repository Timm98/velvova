import Fastify from "fastify";
import { loadRuntimeConfig } from "@paycheck/config";
import { registerRoutes } from "./routes/index.ts";

/**
 * Die typisierte API.
 *
 * Sie bedient die native App und spaetere Partner. Die Weboberflaeche
 * nutzt heute Route Handler in Next - das haelt den Entwicklungsweg kurz.
 * Beide teilen sich dieselben Pakete fuer Domaene, Bewertung und
 * Datenbank, sodass es keine zweite Wahrheit gibt. Siehe docs/adr/0005.
 */

const cfg = loadRuntimeConfig();

export function buildServer() {
  const app = Fastify({
    logger: {
      level: cfg.nodeEnv === "production" ? "info" : "debug",
      // Personenbezogenes gehoert nicht in Protokolle.
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.body.password",
          "req.body.answer",
          "req.body.statement",
          "res.headers['set-cookie']",
        ],
        censor: "[entfernt]",
      },
    },
    disableRequestLogging: false,
    trustProxy: true,
  });

  app.addHook("onSend", async (_req, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("X-Frame-Options", "DENY");
  });

  registerRoutes(app);
  return app;
}

const isMain = process.argv[1]?.endsWith("server.ts");
if (isMain) {
  const app = buildServer();
  const port = Number(process.env.API_PORT ?? 3001);
  app
    .listen({ port, host: "127.0.0.1" })
    .then(() => {
      app.log.info(
        `API laeuft auf http://127.0.0.1:${port} (Modus: ${cfg.mode}, Datenbank: ${cfg.db.driver})`,
      );
    })
    .catch((err) => {
      app.log.error(err);
      process.exit(1);
    });
}
