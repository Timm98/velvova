"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "./auth";

/**
 * Einstellungen speichern.
 *
 * Alles hier schreibt wirklich in die Datenbank. Das klingt
 * selbstverständlich und ist es nicht: eine Auswahl, die nur den
 * Zustand einer Komponente ändert, sieht exakt so aus wie eine, die
 * gespeichert wurde — bis zum nächsten Neuladen. Genau diese Sorte
 * Fehler ist von außen unsichtbar und von innen trivial.
 *
 * Jede Funktion prüft ihre Eingabe mit einem Schema. Ein Wert wie
 * `theme = "<script>"` landet dann nicht in der Datenbank, sondern im
 * Fehlerzweig.
 */

/** Der Datensatz existiert immer, sobald jemand etwas einstellt. */
async function ensureSettings(userId: string) {
  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx
      .insert(schema.userSettings)
      .values({ userId })
      .onConflictDoNothing({ target: schema.userSettings.userId }),
  );
  return db;
}

async function patch(userId: string, werte: Record<string, unknown>): Promise<void> {
  const db = await ensureSettings(userId);
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.userSettings)
      .set({ ...werte, updatedAt: new Date() })
      .where(eq(schema.userSettings.userId, userId)),
  );
}

/* ── Erscheinungsbild ──────────────────────────────────────────── */

const ThemeSchema = z.enum(["light", "dark", "system"]);

export async function saveTheme(value: string): Promise<{ ok: boolean }> {
  const parsed = ThemeSchema.safeParse(value);
  if (!parsed.success) return { ok: false };

  const user = await requireUser();
  await patch(user.id, { theme: parsed.data });
  return { ok: true };
}

/* ── Sprache ───────────────────────────────────────────────────── */

const LocaleSchema = z.enum(["de", "en"]);

/**
 * Drei Sprachen, drei Entscheidungen.
 *
 * Jemand kann die Oberfläche auf Deutsch wollen, mit Nina lieber auf
 * Englisch sprechen und die Bewerbung auf Deutsch schreiben. Ein
 * einziges Feld hätte alle drei aneinandergekettet.
 */
export async function saveLanguages(input: {
  locale?: string;
  assistantLocale?: string;
  documentLocale?: string;
}): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const werte: Record<string, unknown> = {};

  for (const [feld, wert] of [
    ["locale", input.locale],
    ["assistantLocale", input.assistantLocale],
    ["documentLocale", input.documentLocale],
  ] as const) {
    if (wert === undefined) continue;
    const parsed = LocaleSchema.safeParse(wert);
    if (!parsed.success) return { ok: false };
    werte[feld] = parsed.data;
  }

  if (Object.keys(werte).length === 0) return { ok: true };
  await patch(user.id, werte);

  // Die Oberflächensprache liegt zusätzlich im Cookie, damit der Server
  // sie schon beim ersten Byte kennt.
  if (typeof werte.locale === "string") {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    store.set("paycheck_locale", werte.locale, {
      path: "/",
      maxAge: 31_536_000,
      sameSite: "lax",
    });
  }

  revalidatePath("/app", "layout");
  return { ok: true };
}

/* ── Standort und Suchraum ─────────────────────────────────────── */

const OrtSchema = z.object({
  country: z.string().length(2).optional(),
  jobMarketCountry: z.string().length(2).optional(),
  baseLocation: z.string().max(120).nullish(),
  /*
   * Grenzen mit Grund: 500 km ist kein Pendelradius mehr, 8 Stunden
   * kein Arbeitsweg. Ein Feld ohne Obergrenze nimmt irgendwann eine
   * Zahl an, mit der die Suche nichts Sinnvolles mehr tut — und die
   * Person sieht nur, dass „nichts passt“.
   */
  searchRadiusKm: z.coerce.number().int().min(0).max(500).nullish(),
  maxCommuteMinutes: z.coerce.number().int().min(0).max(240).nullish(),
  timezone: z.string().max(64).optional(),
  currency: z.string().length(3).optional(),
  distanceUnit: z.enum(["km", "mi"]).optional(),
  commuteMode: z.enum(["public_transport", "car", "bike", "walk"]).optional(),
  willingToRelocate: z.coerce.boolean().optional(),
  remotePreference: z.enum(["no_preference", "remote_only", "hybrid", "onsite"]).optional(),
});

export async function saveLocation(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = OrtSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }

  const user = await requireUser();
  const werte = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(werte).length === 0) return { ok: true };

  await patch(user.id, werte);
  revalidatePath("/app/settings/language-region");
  return { ok: true };
}

/* ── Benachrichtigungen ────────────────────────────────────────── */

export async function saveNotifications(input: {
  email?: boolean;
  push?: boolean;
}): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const werte: Record<string, unknown> = {};
  if (input.email !== undefined) werte.notificationEmail = Boolean(input.email);
  if (input.push !== undefined) werte.notificationPush = Boolean(input.push);
  if (Object.keys(werte).length === 0) return { ok: true };

  await patch(user.id, werte);
  revalidatePath("/app/settings/notifications");
  return { ok: true };
}

/* ── Stimme und Gespräch ───────────────────────────────────────── */

const StimmeSchema = z.object({
  microphoneEnabled: z.coerce.boolean().optional(),
  voiceAutoplay: z.coerce.boolean().optional(),
  voiceCaptions: z.coerce.boolean().optional(),
  voiceSpeed: z.coerce.number().min(0.5).max(2).optional(),
  deleteAudioAfterTranscript: z.coerce.boolean().optional(),
});

export async function saveVoice(input: unknown): Promise<{ ok: boolean }> {
  const parsed = StimmeSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const user = await requireUser();
  const werte = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(werte).length === 0) return { ok: true };

  await patch(user.id, werte);
  revalidatePath("/app/settings/voice");
  return { ok: true };
}
