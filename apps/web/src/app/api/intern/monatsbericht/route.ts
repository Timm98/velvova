import { NextResponse } from "next/server";
import { monatsberichteLaufen } from "@paycheck/jobs/monatsbericht";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Der Zeitplan ruft hier an — täglich, nicht monatlich.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum täglich, obwohl es ein Monatsbericht ist
 * ══════════════════════════════════════════════════════════════
 *
 * Weil ein Auslöser, der einmal im Monat feuert, genau einen Versuch
 * hat. Fällt er aus — ein Ausfall beim Anbieter, ein Fehler beim
 * Ausrollen, eine Stunde ohne Datenbank —, fehlt der Monat, und
 * niemand merkt es bis zum nächsten. Weder GitHub Actions noch Vercel
 * wiederholen einen fehlgeschlagenen Zeitplanaufruf von selbst.
 *
 * Täglich anzurufen kostet nichts, weil der Lauf sich selbst begrenzt:
 * Ein eindeutiger Teilindex über (Organisation, Berichtsmonat) lässt
 * genau eine Zeile je Monat zu. Der zweite Anruf desselben Monats
 * schreibt nichts und meldet `uebersprungen`.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Endpunkt und nicht nur der Worker
 * ══════════════════════════════════════════════════════════════
 *
 * `apps/worker` läuft in der Entwicklung. Produktiv weckt GitHub
 * Actions einen internen Endpunkt — derselbe Weg wie beim Stellenabruf
 * und beim Schnappschuss.
 */
export async function POST(request: Request) {
  const geheimnis = process.env.JOBS_REFRESH_SECRET;
  const kopf = request.headers.get("authorization");
  if (!geheimnis || kopf !== `Bearer ${geheimnis}`) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 401 });
  }

  try {
    const bericht = await monatsberichteLaufen();
    return NextResponse.json({ ok: true, ...bericht });
  } catch (fehler) {
    /*
     * Der Fehler steht in der Antwort, nicht nur im Protokoll. Ein
     * Zeitplan, der jeden Tag „ok" meldet, während seit Monaten kein
     * Bericht entsteht, ist schlimmer als einer, der rot ist.
     */
    const text = fehler instanceof Error ? fehler.message : String(fehler);
    console.error("[monatsbericht] fehlgeschlagen:", text);
    return NextResponse.json({ ok: false, fehler: text.slice(0, 300) }, { status: 500 });
  }
}
