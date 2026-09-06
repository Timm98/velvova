/**
 * Wohin nach dem Anmelden: mitgegebenes Ziel oder Einstiegspunkt.
 *
 * Ein mitgegebenes Ziel gewinnt — aber nur, wenn der Einstiegspunkt
 * schon in der Anwendung liegt. `entryRoute` gibt `/setup` zurück,
 * solange das Onboarding nicht fertig ist; ein unfertiges Profil auf
 * eine Stellenseite zu schicken hiesse, ihm eine Bewertung zu zeigen,
 * für die die Grundlage fehlt.
 *
 * Als eigenes Modul, nicht neben der Aktion: `actions.ts` trägt
 * `"use server"`, und dort darf jeder Export nur eine asynchrone
 * Funktion sein. Eine synchrone Hilfsfunktion daneben bricht den Build
 * — `use-server.test.ts` prüft genau das.
 */
export function zielNachLogin(einstieg: string, ziel: string | null): string {
  if (!ziel) return einstieg;
  return einstieg.startsWith("/app") ? ziel : einstieg;
}

