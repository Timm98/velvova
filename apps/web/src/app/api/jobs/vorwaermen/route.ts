import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { stellenseiteVorwaermen } from "@/lib/jobs/seitendaten";

export const dynamic = "force-dynamic";

/**
 * Die Stellenseite im Hintergrund vorbereiten.
 *
 * ══════════════════════════════════════════════════════════════
 * Wofür das gut ist
 * ══════════════════════════════════════════════════════════════
 *
 * Alles, was die Stellenseite über die Person wissen muss, kostet
 * gemessen 366 Millisekunden — fast ausschliesslich Netzrunden gegen
 * Supabase. Wer aus dem Gespräch dorthin wechselt, wartet sie ab.
 *
 * Er muss nicht. Während jemand mit Monday spricht, passiert an
 * diesen Daten nichts, und sie lassen sich vorher holen. Dieser
 * Endpunkt tut genau das und sonst nichts.
 *
 * ══════════════════════════════════════════════════════════════
 * Was er ausdrücklich NICHT kann
 * ══════════════════════════════════════════════════════════════
 *
 * Er nimmt keine Parameter. Es gibt keine Kennung, keinen Nutzernamen,
 * kein Feld, über das jemand die Daten einer anderen Person anfordern
 * könnte — gewärmt wird immer und ausschliesslich der Stand der
 * angemeldeten Person, und `requireUser` bestimmt, wer das ist.
 *
 * Und er gibt nichts zurück. Die Antwort ist 204: kein Inhalt, kein
 * Hinweis darauf, was gefunden wurde. Ein Endpunkt, der Daten
 * vorbereitet, muss sie nicht auch ausliefern — dafür gibt es die
 * Seite.
 */
export async function POST(): Promise<NextResponse> {
  const user = await requireUser();
  await stellenseiteVorwaermen(user.id);
  return new NextResponse(null, { status: 204 });
}
