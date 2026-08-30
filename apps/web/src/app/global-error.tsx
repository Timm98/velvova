"use client";

import { useEffect } from "react";

/**
 * Die letzte Instanz.
 *
 * Greift, wenn das Wurzellayout selbst gescheitert ist — dann gibt es
 * keine Schriften, keine Gestaltungsvariablen und kein Layout mehr.
 * Deshalb steht hier alles inline und ohne eine einzige Abhängigkeit:
 * eine Fehlerseite, die ihrerseits etwas importiert, kann mit
 * demselben Fehler ausfallen.
 *
 * Die Farben sind bewusst fest verdrahtet. Zu diesem Zeitpunkt ist
 * nicht gesichert, dass die Token geladen wurden.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Fehler im Wurzellayout:", error.digest ?? "ohne Kennung", error.message);
  }, [error]);

  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          background: "#f7f8fc",
          color: "#0d1017",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ maxWidth: "46ch", display: "grid", gap: "1.25rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0, letterSpacing: "-0.02em" }}>
            Die Anwendung konnte nicht geladen werden.
          </h1>

          <p style={{ margin: 0, lineHeight: 1.6, color: "#667085" }}>
            Der Fehler liegt bei uns. Versuch es in einem Moment noch einmal — deine Daten sind
            davon nicht betroffen.
          </p>

          <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: "2.5rem",
                padding: "0 1.25rem",
                borderRadius: 999,
                border: "none",
                background: "#0d1017",
                color: "#ffffff",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Erneut versuchen
            </button>
            <a href="/" style={{ fontSize: "0.875rem", color: "#635bff" }}>
              Zur Startseite
            </a>
          </div>

          {error.digest && (
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#98a2b3", fontFamily: "ui-monospace, monospace" }}>
              Kennung: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
