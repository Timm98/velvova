import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./config.ts";

/**
 * Supabase auf dem Server.
 *
 * Die Sitzung liegt in Cookies, und @supabase/ssr schreibt sie bei
 * jedem Auffrischen des Tokens neu. In einer Server Component darf man
 * keine Cookies setzen — Next lässt das nur in Server Actions und Route
 * Handlers zu. Der Schreibversuch wird deshalb bewusst verschluckt: die
 * Middleware frischt die Sitzung ohnehin bei jeder Navigation auf, und
 * ohne dieses try/catch bricht jede Seite ab, sobald ein Token abläuft.
 */
export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase ist nicht eingerichtet. Es fehlen NEXT_PUBLIC_SUPABASE_URL " +
        "und NEXT_PUBLIC_SUPABASE_ANON_KEY. Ohne sie läuft die eingebettete Datenbank.",
    );
  }

  const store = await cookies();

  return createServerClient(supabaseUrl()!, supabaseAnonKey()!, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Server Component: das Auffrischen übernimmt die Middleware.
        }
      },
    },
  });
}
