import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema, withUser } from "@paycheck/db";
import {
  StimmeFehlgeschlagenError,
  StimmeNichtEingerichtetError,
  spreche,
} from "@/lib/nina/voice";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Mondays Stimme als Tonstrom.
 *
 * Der wichtigste Teil steht in der Eingabeprüfung: **es geht keine
 * Zeichenkette vom Client hinein.** Der Client nennt eine
 * Nachrichtenkennung; der Server holt den Text aus der Datenbank und
 * liest ihn vor.
 *
 * Der Unterschied ist nicht theoretisch. Eine Route, die beliebigen
 * Text vorliest, ist ein fremdfinanzierter Sprachsynthesedienst: wer
 * die Adresse kennt, lässt darüber Hörbücher erzeugen, und die Rechnung
 * kommt hierher. Außerdem könnte Monday dann Sätze sagen, die sie nie
 * gesagt hat.
 *
 * Die Zeilensicherheit sorgt dafür, dass niemand die Nachricht eines
 * anderen Menschen vorlesen lässt.
 */

const BodySchema = z.object({
  messageId: z.string().uuid(),
});

export async function POST(request: Request) {
  const user = await requireUser();

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const db = await getDb();
  const [nachricht] = await withUser(db, user.id, (tx) =>
    tx
      .select({ content: schema.ninaMessages.content, role: schema.ninaMessages.role })
      .from(schema.ninaMessages)
      .where(
        and(
          eq(schema.ninaMessages.id, parsed.data.messageId),
          eq(schema.ninaMessages.userId, user.id),
        ),
      )
      .limit(1),
  );

  if (!nachricht) {
    return Response.json({ error: "Nachricht nicht gefunden." }, { status: 404 });
  }

  // Nur Monday wird vorgelesen. Die eigene Nachricht vorgelesen zu
  // bekommen wäre kein Merkmal, sondern ein Fehler.
  if (nachricht.role !== "assistant") {
    return Response.json({ error: "Nur Mondays Antworten werden vorgelesen." }, { status: 400 });
  }

  try {
    /*
     * Das Abbruchsignal der Anfrage geht durch.
     *
     * Schließt der Browser die Verbindung — weil die Person Monday
     * unterbricht oder die Seite wechselt —, hört auch die Erzeugung
     * auf. Ohne diese Weitergabe läuft die Rechnung weiter, während
     * niemand mehr zuhört.
     */
    const { audio, contentType } = await spreche(nachricht.content, {
      signal: request.signal,
    });

    return new Response(audio, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        // Der Ton gehört zu einer Person. Er darf nirgends zwischenliegen.
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (fehler) {
    if (fehler instanceof StimmeNichtEingerichtetError) {
      // Der NAME der fehlenden Variablen, nie ihr Wert.
      console.error("[nina/speak] nicht eingerichtet:", fehler.missingVariable);
      return Response.json(
        { error: "voice_not_configured", message: "Die Sprachausgabe ist gerade nicht verfügbar." },
        { status: 503 },
      );
    }

    if (fehler instanceof StimmeFehlgeschlagenError) {
      console.error("[nina/speak] Anbieter antwortete mit", fehler.status);
      return Response.json(
        { error: "voice_failed", message: "Die Sprachausgabe ist gerade nicht verfügbar." },
        { status: 503 },
      );
    }

    // Ein Abbruch durch die Person ist kein Fehler, sondern das Ende.
    if (fehler instanceof DOMException && fehler.name === "AbortError") {
      return new Response(null, { status: 499 });
    }

    console.error(
      "[nina/speak] unerwartet:",
      fehler instanceof Error ? `${fehler.name}: ${fehler.message}` : String(fehler),
    );
    return Response.json(
      { error: "voice_failed", message: "Die Sprachausgabe ist gerade nicht verfügbar." },
      { status: 503 },
    );
  }
}
