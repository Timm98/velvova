"use client";

import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./config.ts";

/**
 * Supabase im Browser.
 *
 * Hier landet ausschließlich der öffentliche Schlüssel. Er ist dafür
 * gemacht, sichtbar zu sein — die Absicherung leisten die
 * RLS-Richtlinien, nicht die Geheimhaltung dieses Werts.
 *
 * Der Client wird einmal erzeugt und wiederverwendet: mehrere Instanzen
 * hören unabhängig voneinander auf Sitzungsänderungen und geraten dann
 * auseinander.
 */
let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  client ??= createBrowserClient(supabaseUrl()!, supabaseAnonKey()!);
  return client;
}
