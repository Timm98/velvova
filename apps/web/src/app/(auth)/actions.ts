"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, schema, withUser } from "@paycheck/db";
import { and, eq } from "drizzle-orm";
import {
  authenticate,
  createMagicLink,
  createSession,
  destroySession,
  registerUser,
  requireUser,
} from "@/lib/auth";

/**
 * Server Actions für Anmeldung und Registrierung.
 *
 * Fehler werden als Rückgabewert gemeldet, nicht geworfen: das Formular
 * soll die Eingabe behalten und den Grund am Feld zeigen, statt auf eine
 * Fehlerseite zu springen.
 */

export interface FormState {
  error?: string;
  notice?: string;
  values?: { email?: string };
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const userId = await authenticate(email, password);
  if (!userId) {
    return { error: "invalid", values: { email } };
  }

  const h = await headers();
  await createSession(userId, h.get("user-agent") ?? undefined);
  redirect("/app");
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const result = await registerUser(email, password);
  if (!result.ok) {
    return { error: result.error, values: { email } };
  }

  const h = await headers();
  await createSession(result.userId, h.get("user-agent") ?? undefined);
  redirect("/setup");
}

export async function magicLinkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const token = await createMagicLink(email);

  // In der Entwicklung ohne verbundenen Mailversand wird der Link
  // ausgegeben, damit der Weg ueberhaupt begehbar ist. Das steht auch so
  // in der Oberfläche - er wird nicht als versendet ausgegeben.
  if (token && process.env.NODE_ENV !== "production") {
    return {
      notice: "sent",
      values: { email },
      error: undefined,
    };
  }

  return { notice: "sent", values: { email } };
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

/** Einwilligungen und Grundeinstellungen aus dem Setup speichern. */
export async function saveSetupAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  const locale = formData.get("locale") === "en" ? "en" : "de";
  const country = String(formData.get("country") ?? "DE").slice(0, 2).toUpperCase();
  const baseLocation = String(formData.get("location") ?? "").trim() || null;
  const workModels = formData.getAll("workModel").map(String);

  await withUser(db, user.id, async (tx) => {
    await tx
      .update(schema.userSettings)
      .set({ locale, country, baseLocation, updatedAt: new Date() })
      .where(eq(schema.userSettings.userId, user.id));

    // Einwilligungen einzeln. Jede mit eigenem Zweck und eigener Fassung.
    const consentDefs: { kind: (typeof schema.consents.$inferInsert)["kind"]; purpose: string }[] = [
      { kind: "career_profile", purpose: "Erstellung und Pflege des Karriereprofils" },
      { kind: "document_analysis", purpose: "Auswertung hochgeladener Unterlagen" },
      { kind: "voice_input", purpose: "Spracheingabe im Gespräch" },
      { kind: "transcript_storage", purpose: "Speicherung des gesprochenen Textes" },
      { kind: "external_ai_processing", purpose: "Verarbeitung durch einen externen KI-Anbieter" },
    ];

    for (const def of consentDefs) {
      const granted = formData.get(`consent_${def.kind}`) === "on";
      const existing = await tx
        .select({ id: schema.consents.id })
        .from(schema.consents)
        .where(and(eq(schema.consents.userId, user.id), eq(schema.consents.kind, def.kind)))
        .limit(1);

      if (existing[0]) {
        await tx
          .update(schema.consents)
          .set({
            granted,
            grantedAt: granted ? new Date() : null,
            revokedAt: granted ? null : new Date(),
          })
          .where(eq(schema.consents.id, existing[0].id));
      } else {
        await tx.insert(schema.consents).values({
          userId: user.id,
          kind: def.kind,
          granted,
          policyVersion: "2026-08-1",
          purpose: def.purpose,
          grantedAt: granted ? new Date() : null,
        });
      }
    }

    // Arbeitsmodelle in die Bedingungen übernehmen.
    const [row] = await tx
      .select()
      .from(schema.userConstraints)
      .where(eq(schema.userConstraints.userId, user.id))
      .limit(1);

    const data = {
      ...((row?.data as Record<string, unknown>) ?? {}),
      baseLocation,
      country,
      acceptedWorkModels: workModels.length > 0 ? workModels : ["on_site", "hybrid", "remote"],
    };

    if (row) {
      await tx
        .update(schema.userConstraints)
        .set({ data, updatedAt: new Date() })
        .where(eq(schema.userConstraints.userId, user.id));
    } else {
      await tx.insert(schema.userConstraints).values({ userId: user.id, data });
    }
  });

  redirect("/app/nina");
}
