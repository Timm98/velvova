"use client";

/**
 * Eine Server Action, die im Erfolgsfall weiterleitet.
 *
 * `redirect()` in einer Server Action bricht die noch laufende Anfrage
 * ab — das ist gewollt und in Chromium unauffällig. WebKit meldet die
 * abgebrochene Anfrage aber als `TypeError: Load failed`, und React
 * reicht das an die nächste Fehlergrenze weiter.
 *
 * Für die Person sieht das so aus: sie legt ein Konto an, für einen
 * Moment erscheint „Da ist etwas schiefgegangen", und dann ist sie
 * angemeldet. Die Registrierung hat funktioniert; nur der Bildschirm
 * hat das Gegenteil behauptet.
 *
 * Diese Hülle unterscheidet den Abbruch durch Weiterleitung von einem
 * echten Netzfehler. Der eine wird geschluckt — die Navigation läuft ja
 * bereits —, der andere geht weiter nach oben.
 */

/** Meldungen, mit denen Browser eine abgebrochene Anfrage beschreiben. */
const ABGEBROCHEN = [
  "load failed",          // WebKit
  "failed to fetch",      // Chromium
  "networkerror",         // Firefox
  "the operation was aborted",
  "aborterror",
];

function istNavigationsabbruch(fehler: unknown): boolean {
  if (!(fehler instanceof Error)) return false;

  // Nur TypeError und AbortError kommen als abgebrochene Anfrage. Ein
  // Fehler aus dem Serverkode hat einen anderen Namen — und den will
  // niemand verschlucken.
  if (fehler.name !== "TypeError" && fehler.name !== "AbortError") return false;

  const text = fehler.message.toLowerCase();
  return ABGEBROCHEN.some((m) => text.includes(m));
}

/**
 * Hüllt eine Action so ein, dass ein Abbruch durch Weiterleitung den
 * vorigen Zustand behält, statt eine Fehlerseite auszulösen.
 */
export function withRedirectSafety<State, Payload>(
  action: (state: State, payload: Payload) => Promise<State>,
): (state: State, payload: Payload) => Promise<State> {
  return async (state, payload) => {
    try {
      return await action(state, payload);
    } catch (fehler) {
      if (istNavigationsabbruch(fehler)) {
        // Die Weiterleitung läuft. Der bisherige Zustand bleibt stehen,
        // bis die neue Seite da ist — sichtbar ist davon nichts.
        return state;
      }
      throw fehler;
    }
  };
}

export const __test = { istNavigationsabbruch };
