import "server-only";

import { createClient } from "@supabase/supabase-js";
import { supabaseServiceKey, supabaseUrl } from "./config.ts";

/**
 * Der serverseitige Zugang mit Dienstschlüssel.
 *
 * Er umgeht Row Level Security. Genau dafür ist er da — der
 * Stellenabruf schreibt in globale Tabellen, für die es bewusst keine
 * Schreib-Policy gibt — und genau deshalb ist er gefährlich.
 *
 * Zwei Vorkehrungen:
 *
 *   1. `import "server-only"` lässt den Build abbrechen, sobald diese
 *      Datei aus einer Client-Komponente erreichbar wäre. Ein
 *      Kommentar hätte diese Wirkung nicht.
 *   2. Keine Sitzungsverwaltung: dieser Client soll nie eine
 *      Nutzersitzung führen, sonst wird aus einem Wartungszugang
 *      versehentlich eine Anmeldung.
 */
export function createSupabaseAdminClient() {
  const url = supabaseUrl();
  const key = supabaseServiceKey();

  if (!url || !key) {
    throw new Error(
      "Für serverseitige Läufe fehlen NEXT_PUBLIC_SUPABASE_URL oder " +
        "SUPABASE_SERVICE_ROLE_KEY. Es wird nichts geschrieben.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
