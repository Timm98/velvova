import { NextResponse } from "next/server";
import { schnappschussNehmen } from "@paycheck/jobs/bedarfsschnappschuss";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Der Zeitplan ruft hier an — einmal am Tag.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Endpunkt und nicht nur der Worker
 * ══════════════════════════════════════════════════════════════
 *
 * `apps/worker` läuft in der Entwicklung. Produktiv weckt GitHub
 * Actions einen internen Endpunkt — derselbe Weg wie beim
 * Stellenabruf, bei den Geodaten und beim Suchauftrag. Stünde der
 * Schnappschuss nur im Worker, liefe er auf keinem Server, und das
 * fiele erst in Monaten auf: Die Tabelle wäre einfach leer, ohne
 * Fehler.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das der einzige Lauf ist, dessen Ausfall zählt
 * ══════════════════════════════════════════════════════════════
 *
 * Alles andere im Zeitplan lässt sich nachrechnen. Ein Tag ohne
 * Schnappschuss ist ein Tag, über den nie jemand etwas sagen kann —
 * die Anzeige, die gestern stand und heute weg ist, hinterlässt keine
 * Spur, aus der sich das später ableiten liesse.
 *
 * Zweimal am selben Tag zu laufen schadet nicht: Der Primärschlüssel
 * enthält den Tag, ein zweiter Lauf schreibt dieselben Zahlen.
 */
export async function POST(request: Request) {
  const geheimnis = process.env.JOBS_REFRESH_SECRET;
  const kopf = request.headers.get("authorization");
  if (!geheimnis || kopf !== `Bearer ${geheimnis}`) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 401 });
  }

  try {
    const bericht = await schnappschussNehmen();
    return NextResponse.json({ ok: true, ...bericht });
  } catch (fehler) {
    /*
     * Der Fehler steht in der Antwort, nicht nur im Protokoll.
     *
     * Ein Zeitplan, der jeden Tag „ok" meldet, während seit Wochen
     * nichts geschrieben wird, ist schlimmer als einer, der rot ist.
     */
    const text = fehler instanceof Error ? fehler.message : String(fehler);
    console.error("[schnappschuss] fehlgeschlagen:", text);
    return NextResponse.json({ ok: false, fehler: text.slice(0, 300) }, { status: 500 });
  }
}
