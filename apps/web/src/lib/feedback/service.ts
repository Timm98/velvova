import { z } from "zod";
import { getDb, schema, withUser } from "@paycheck/db";

/**
 * Rückmeldungen aus dem Produkt.
 *
 * Zwei Dinge machen den Unterschied zwischen brauchbarem Feedback und
 * einem Postfach voller „geht nicht":
 *
 * **Der Kontext kommt automatisch mit.** Route, Funktion, Schritt im
 * Vorgang. Wer das von Hand tippen muss, tippt es nicht.
 *
 * **Persönliches kommt nicht mit.** Kein Anzeigentext, kein
 * Bewerbungsentwurf, kein Gesprächsinhalt. Ein Fehlerbericht, der
 * nebenbei einen halben Lebenslauf mitschickt, ist ein Datenleck mit
 * guter Absicht.
 */

export const FeedbackInput = z.object({
  category: z.enum([
    "bug",
    "wrong_job",
    "wrong_nina_statement",
    "missing_feature",
    "confusing_ui",
    "application_problem",
    "privacy",
    "idea",
    "praise",
    "other",
  ]),
  message: z.string().min(5).max(4000),
  title: z.string().max(200).optional(),
  route: z.string().max(300).optional(),
  featureKey: z.string().max(100).optional(),
  workflowState: z.string().max(100).optional(),
  jobId: z.string().uuid().optional(),
  applicationId: z.string().uuid().optional(),
  consentToContact: z.boolean().default(false),
  /*
   * Eine Vorgangsnummer aus einer früheren Antwort (§25).
   *
   * Als freier Text und nicht als UUID geprüft: Menschen tippen sie aus
   * einer E-Mail ab, mit Bindestrichen, Leerzeichen oder halb. Eine
   * strenge Prüfung würde hier die Nachricht ablehnen, statt einen
   * Hinweis mitzunehmen, der ohnehin nur beim Zuordnen hilft.
   */
  ticketId: z.string().max(100).optional(),
  /*
   * Der Honigtopf. Der Endpunkt wertet ihn vor dieser Prüfung aus; hier
   * steht er nur, damit ein ausgefülltes Feld nicht als unbekannter
   * Schlüssel die ganze Nachricht scheitern lässt.
   */
  website: z.string().max(200).optional(),
});

export type FeedbackInput = z.infer<typeof FeedbackInput>;

/**
 * Was aus dem technischen Kontext übrig bleiben darf.
 *
 * Die Adresszeile enthält oft Kennungen und Suchbegriffe. Ein
 * Suchbegriff wie „Jobs Hamburg Teilzeit Pflege" sagt mehr über eine
 * Person, als sie in einen Fehlerbericht schreiben wollte.
 */
export function redactRoute(route: string): string {
  try {
    const url = new URL(route, "http://localhost");
    // Kennungen durch ihre Form ersetzen: der Pfad bleibt lesbar, die
    // konkrete Zeile verschwindet.
    const pfad = url.pathname
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
      .replace(/\/\d+(?=\/|$)/g, "/:n");
    return pfad;
  } catch {
    return route.split("?")[0] ?? route;
  }
}

/** Grobe Geräteklasse. Kein Fingerabdruck. */
export function deviceClass(userAgent: string): "mobil" | "tablet" | "desktop" {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobi|android|iphone/.test(ua)) return "mobil";
  return "desktop";
}

/** Nur die Familie, nicht die Fassung. Die Fassung ist ein Merkmal. */
export function browserFamily(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("firefox")) return "Firefox";
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("chrome") && !ua.includes("edg/")) return "Chrome";
  if (ua.includes("safari")) return "Safari";
  return "unbekannt";
}

export async function saveFeedback(
  input: FeedbackInput,
  context: { userId: string | null; userAgent: string; appVersion: string },
): Promise<{ id: string }> {
  const db = await getDb();

  const werte = {
    userId: context.userId,
    category: input.category,
    title: input.title ?? null,
    message: input.message,
    route: input.route ? redactRoute(input.route) : null,
    featureKey: input.featureKey ?? null,
    workflowState: input.workflowState ?? null,
    jobId: input.jobId ?? null,
    applicationId: input.applicationId ?? null,
    appVersion: context.appVersion,
    browser: browserFamily(context.userAgent),
    deviceType: deviceClass(context.userAgent),
    consentToContact: input.consentToContact,
  };

  // Anonym ist erlaubt: wer ein Datenschutzproblem meldet, soll das
  // nicht mit seinem Namen tun müssen.
  const [zeile] = context.userId
    ? await withUser(db, context.userId, (tx) =>
        tx.insert(schema.feedbackItems).values(werte).returning({ id: schema.feedbackItems.id }),
      )
    : await db.insert(schema.feedbackItems).values(werte).returning({ id: schema.feedbackItems.id });

  return { id: zeile!.id };
}

/**
 * Wann eine Rückfrage angebracht ist — und wann nicht.
 *
 * Direkt nach einer Absage nach einer Bewertung zu fragen, ist
 * gedankenlos. Der Moment gehört der Person, nicht unserer
 * Produktverbesserung.
 */
const UNPASSEND = new Set(["rejection_received", "offer_declined", "application_withdrawn"]);

export function mayAskForMicroFeedback(workflowState: string | null): boolean {
  if (!workflowState) return true;
  return !UNPASSEND.has(workflowState);
}
