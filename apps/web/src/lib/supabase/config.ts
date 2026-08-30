/**
 * Supabase-Konfiguration und ihr ehrlicher Zustand.
 *
 * Die wichtigste Funktion hier ist `supabaseStatus()`. Sie sagt, ob
 * Supabase wirklich eingerichtet ist — und die Oberfläche zeigt genau
 * das an. Es gibt keine Stelle, an der eine Verbindung als bestehend
 * dargestellt wird, die nicht besteht.
 *
 * Der Dienstschlüssel wird ausschließlich hier gelesen und nur an
 * serverseitigen Code weitergegeben. Er darf niemals in ein
 * Client-Bundle geraten; deshalb trägt er auch kein NEXT_PUBLIC_.
 */

export interface SupabaseStatus {
  /** Reichen die öffentlichen Angaben für Anmeldung und Abfragen? */
  configured: boolean;
  /** Liegt zusätzlich der Dienstschlüssel für serverseitige Läufe vor? */
  serviceRole: boolean;
  url: string | null;
  /** Fehlende Variablen, beim Namen genannt. */
  missing: string[];
  /** Ein Satz, der in der Oberfläche stehen kann. */
  summary: string;
}

export function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
}

export function supabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    undefined
  );
}

/**
 * Nur serverseitig aufrufen.
 *
 * Supabase hat den Namen gewechselt: `SUPABASE_SECRET_KEY` ist der
 * aktuelle, `SUPABASE_SERVICE_ROLE_KEY` der ältere. Beide werden
 * gelesen, der neue hat Vorrang — sonst richtet jemand nach der
 * aktuellen Dokumentation ein und die Anwendung meldet trotzdem
 * "fehlt".
 */
export function supabaseServiceKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}

export function supabaseStatus(): SupabaseStatus {
  const url = supabaseUrl();
  const anon = supabaseAnonKey();
  const service = supabaseServiceKey();

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anon) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!service) missing.push("SUPABASE_SECRET_KEY");

  const configured = Boolean(url && anon);

  return {
    configured,
    serviceRole: Boolean(service),
    url: url ?? null,
    missing,
    summary: configured
      ? service
        ? `Verbunden mit ${url}. Anmeldung, Datenbank und Ablage laufen über Supabase.`
        : `Verbunden mit ${url}, aber ohne Dienstschlüssel (SUPABASE_SECRET_KEY). ` +
          "Anmeldung ist möglich; serverseitige Läufe wie der Stellenabruf können nicht schreiben."
      : "Nicht eingerichtet. Es läuft die eingebettete Datenbank; Anmeldung und Ablage sind lokal. " +
        "Die Migrationen liegen unter supabase/migrations und sind einsatzbereit.",
  };
}
