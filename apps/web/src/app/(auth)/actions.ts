"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { zielNachLogin } from "@/lib/auth/ziel";
import { getDb, schema, withUser } from "@paycheck/db";
import { loadRuntimeConfig } from "@paycheck/config";
import { and, eq } from "drizzle-orm";
import {
  authenticate,
  createMagicLink,
  createSession,
  destroySession,
  registerUser,
  requireUser,
} from "@/lib/auth";
import {
  ensureWorkflowState,
  entryRoute,
  sanitiseRoute as sichereRoute,
  updateWorkflowState,
} from "@/lib/nina/workflow-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ausSupabaseNutzer, verknuepfeIdentitaet } from "@/lib/auth/fremdanmeldung";
import { lesbarerFehler, protokolliereFehler } from "@/lib/auth/fehlertexte";

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
  /*
   * „Eingeloggt bleiben" ist abwählbar, und zwar mit Folgen.
   *
   * Ohne Häkchen bekommt der Browser ein Sitzungscookie: Beim
   * Schliessen ist die Anmeldung weg. Das ist der Fall, für den es das
   * Kästchen gibt — ein fremder oder geteilter Rechner.
   *
   * Voreingestellt ist es angehakt. Wer das Formular abschickt, ohne
   * hinzusehen, soll nicht bei jedem Start neu tippen müssen.
   */
  const bleiben = formData.get("bleiben") !== null;
  await createSession(userId, h.get("user-agent") ?? undefined, bleiben);

  /*
   * Wohin nach dem Login?
   *
   * Nicht pauschal auf die Startseite und schon gar nicht pauschal ins
   * Interview. Der gespeicherte Vorgangszustand entscheidet: wer
   * unterbrochen hat, macht dort weiter; wer fertig ist, landet bei
   * seiner Jobliste. Genau der Fehler, den das Produkt vorher hatte —
   * ein abgeschlossenes Interview begann bei jedem Login von vorn.
   */
  const state = await ensureWorkflowState(userId);

  /*
   * Ein mitgegebenes Ziel geht vor — aber nur für fertige Konten.
   *
   * `sicheresZiel` gab es bisher nur bei der Registrierung. Damit
   * verlor jeder, der aus der öffentlichen Stellensuche auf eine
   * Anzeige klickte und sich anmeldete, genau diese Anzeige: der
   * Login schickte ihn auf seine Liste.
   *
   * Wer mitten im Setup steckt, wird trotzdem dorthin geführt. Ein
   * unfertiges Profil auf eine Stellenseite zu schicken, hiesse ihm
   * eine Bewertung zu zeigen, für die die Grundlage fehlt.
   */
  redirect(zielNachLogin(entryRoute(state), sicheresZiel(formData.get("weiter"))));
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  /*
   * Das Kästchen ist angehakt, wenn es mitgeschickt wird — so
   * funktionieren Kontrollkästchen in Formularen. Fehlt es, hat es
   * jemand abgewählt.
   */
  const benachrichtigen = formData.get("benachrichtigen") !== null;

  const result = await registerUser(email, password, benachrichtigen);
  if (!result.ok) {
    return { error: result.error, values: { email } };
  }

  const h = await headers();
  await createSession(result.userId, h.get("user-agent") ?? undefined);
  // Ein neues Konto geht immer durch das Setup. Der Zustand wird hier
  // angelegt, damit die Weiterleitung ab jetzt eine Grundlage hat.
  await ensureWorkflowState(result.userId);
  redirect(sicheresZiel(formData.get("weiter")) ?? "/nina-einrichten");
}

/**
 * Ein Ziel aus dem Formular — oder nichts.
 *
 * Wer über „Unternehmen registrieren" kommt, soll nach der Anmeldung im
 * Arbeitgeberbereich landen und nicht in der Jobsuche. Die Absicht
 * reist deshalb als verstecktes Feld mit.
 *
 * Geprüft wird streng, denn ein durchgereichtes Ziel ist die klassische
 * offene Weiterleitung: Ein Link auf die eigene Registrierung, der
 * danach auf eine fremde Seite führt, ist ein fertiger Phishing-Bauplan.
 * Erlaubt ist deshalb NUR ein Pfad auf dieser Anwendung — beginnend mit
 * einem einzelnen Schrägstrich, ohne Schema, ohne Host, ohne
 * Backslash-Trick.
 */
function sicheresZiel(wert: FormDataEntryValue | null): string | null {
  if (typeof wert !== "string") return null;
  const z = wert.trim();
  if (!z.startsWith("/")) return null;
  if (z.startsWith("//") || z.startsWith("/\\")) return null;
  if (/[\r\n]/.test(z)) return null;
  return z.slice(0, 200);
}

export async function magicLinkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const token = await createMagicLink(email);

  /*
   * ── Was hier gefehlt hat ──────────────────────────────────────
   *
   * Der Kommentar an dieser Stelle sagte, in der Entwicklung werde der
   * Link ausgegeben, „damit der Weg überhaupt begehbar ist". Der Code
   * darunter gab nichts aus: derselbe `notice: "sent"` wie im
   * Produktivfall. Der Weg war nirgends begehbar — es gab bis eben
   * nicht einmal eine Route, die ein Token einlösen konnte.
   *
   * ── Warum der Link NICHT in die Oberfläche geht ───────────────
   *
   * Ein Anmeldelink im Browser wäre eine Anmeldung ohne Passwort für
   * jeden, der eine fremde Adresse in das Formular tippt — gegen eine
   * Datenbank mit echten Konten. Deshalb geht er auf die
   * Serverkonsole, die nur sieht, wer den Server betreibt.
   *
   * Die Antwort an den Browser bleibt in jedem Fall dieselbe: Sie darf
   * nicht verraten, ob es die Adresse gibt.
   */
  if (token && loadRuntimeConfig().mail.provider === "draft") {
    const ziel = new URL("/magic", loadRuntimeConfig().appUrl);
    ziel.searchParams.set("token", token);
    console.info(`[anmeldelink] ${email}: ${ziel.toString()}`);
  }

  return { notice: "sent", values: { email } };
}

/**
 * Die SMS ist bestätigt — jetzt die eigene Sitzung.
 *
 * ── Warum das hier und nicht im Browser passiert ──────────────
 *
 * Nach `verifyOtp` hat der Browser eine Supabase-Sitzung. Damit ist
 * bewiesen, dass die SMS angekommen ist — mehr nicht. Die Anmeldung
 * an dieser Anwendung ist ein eigener Vorgang: Sie legt eine Zeile in
 * `sessions` an, und daran hängen die Zeilenrechte jeder Abfrage.
 *
 * Diese Aktion liest die Supabase-Sitzung aus den Cookies, prüft sie
 * **beim Server von Supabase** und stellt danach unsere aus. Der
 * Unterschied ist wichtig: `getUser()` fragt nach, `getSession()`
 * liest nur das mitgeschickte Token. Ein Token, das der Browser
 * geschickt hat, ist eine Behauptung, bis jemand sie prüft — und auf
 * einer Anmeldung darf man das nicht auslassen.
 *
 * Danach wird die Supabase-Sitzung beendet: zwei Sitzungen
 * nebeneinander sind eine zu viel, und die zweite überlebte jedes
 * Abmelden.
 */
export async function telefonAnmeldungAbschliessen(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) {
    return { error: "Die Anmeldung per Telefonnummer ist gerade nicht verfügbar." };
  }

  let userId: string;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      protokolliereFehler("telefon:getUser", error);
      return { error: "Die Bestätigung ist abgelaufen. Bitte fordere einen neuen Code an." };
    }

    ({ userId } = await verknuepfeIdentitaet(ausSupabaseNutzer(data.user)));
    await createSession(userId, (await headers()).get("user-agent") ?? undefined, true);
    await supabase.auth.signOut().catch(() => undefined);
  } catch (fehler) {
    protokolliereFehler("telefon:abschluss", fehler);
    return { error: lesbarerFehler(fehler) };
  }

  const state = await ensureWorkflowState(userId);
  redirect(zielNachLogin(entryRoute(state), sichereRoute(String(formData.get("weiter") ?? ""))));
}

export async function logoutAction(): Promise<void> {
  await destroySession();

  /*
   * Auch die Supabase-Sitzung beenden — falls doch eine dasteht.
   *
   * Im Normalfall gibt es keine: Google- und SMS-Anmeldung beenden
   * sie sofort nach dem Ausstellen unserer eigenen. Bleibt eine
   * übrig — ein abgebrochener Rückweg, ein Fehler zwischen den
   * beiden Schritten —, dann läge im Browser ein Cookie, das sich
   * selbst auffrischt und ein Abmelden überlebt.
   *
   * Ein Fehlschlag darf das Abmelden nicht aufhalten: Unsere Sitzung
   * ist zu diesem Zeitpunkt bereits weg, und genau darauf kommt es an.
   */
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch (fehler) {
      protokolliereFehler("logout:supabase", fehler);
    }
  }

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

    await tx
      .update(schema.userSettings)
      .set({ onboardingCompletedAt: new Date() })
      .where(eq(schema.userSettings.userId, user.id));
  });

  /*
   * Erst hier gilt das Onboarding als durchlaufen.
   *
   * Ohne diese Zeile schickt `entryRoute()` die Person bei jedem Login
   * wieder ins Setup — und zwar für immer, weil das Setup selbst nie
   * vermerkt hat, dass es fertig ist. Genau dieser Fall ist im
   * Durchlauf aufgefallen: Konto angelegt, Setup ausgefüllt, beim
   * zweiten Login wieder Setup.
   */
  await updateWorkflowState(user.id, {
    onboardingComplete: true,
    currentWorkflowStep: "career_interview",
  });

  redirect("/app/nina");
}
