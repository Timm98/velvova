import { NextResponse } from "next/server";
import { Nomado24Adapter } from "@paycheck/jobs";

/**
 * Nomado24 ansehen, ohne die Quelle produktiv zu schalten.
 *
 * ══════════════════════════════════════════════════════════════
 * Wozu es diesen Endpunkt gibt
 * ══════════════════════════════════════════════════════════════
 *
 * Die Quelle ist gesperrt, solange die kommerzielle Freigabe fehlt —
 * sie läuft also in keiner Ernte mit. Trotzdem muss man sehen können,
 * was sie liefert: ob das Modell noch passt, ob Felder dazugekommen
 * sind, ob das Arbeitsmodell sauber ankommt.
 *
 * Genau dafür ist er da, und für nichts sonst. Es wird nichts
 * gespeichert, nichts analysiert, nichts abgeglichen.
 *
 * ══════════════════════════════════════════════════════════════
 * Drei Riegel, nach dem Muster von `api/dev/login`
 * ══════════════════════════════════════════════════════════════
 *
 *  1. nur ausserhalb von Produktion
 *  2. nur mit ausdrücklich gesetztem DEV_NOMADO24_DEBUG=true
 *  3. nur über einen Loopback-Host
 *
 * Sonst 404 — als gäbe es ihn nicht. Nicht 403: Ein 403 verrät, dass
 * hier etwas liegt.
 *
 * ── Warum der Adapter hier ausdrücklich aktiv gesetzt wird ──
 *
 * `ENABLE_NOMADO24` ist die PRODUKTIVE Freigabe. Sie hier
 * mitzubenutzen hiesse: Wer nachsehen will, was die API liefert, muss
 * die Quelle scharfstellen. Der Debug-Weg trägt deshalb seinen eigenen
 * Schalter, und er schaltet nur diesen Endpunkt frei.
 */
export const dynamic = "force-dynamic";

function verboten(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") return verboten();
  if (process.env.DEV_NOMADO24_DEBUG !== "true") return verboten();

  const host = new URL(request.url).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) return verboten();

  const roh = Number.parseInt(new URL(request.url).searchParams.get("limit") ?? "10", 10);
  const limit = Number.isFinite(roh) ? Math.min(Math.max(roh, 1), 50) : 10;

  try {
    const adapter = new Nomado24Adapter({ aktiv: true });
    const anzeigen = await adapter.fetchListings({ limit });

    return NextResponse.json({
      provider: "nomado24",
      count: anzeigen.length,
      attribution: adapter.attributionText,
      /*
       * Nur normalisierte, unkritische Felder.
       *
       * `raw` steht bewusst NICHT dabei: Es ist der ungeprüfte Satz
       * des Anbieters, und ein Debug-Endpunkt ist kein Grund, ihn
       * durch die Gegend zu schicken. Wer ihn braucht, liest ihn aus
       * der Datenbank.
       */
      jobs: anzeigen.map((a) => ({
        externalId: a.externalId,
        title: a.title,
        companyName: a.companyName || null,
        locationText: a.location || null,
        remoteType: a.workModel ?? "unknown",
        description: a.description || null,
        salaryMin: a.salaryMin ?? null,
        salaryMax: a.salaryMax ?? null,
        salaryCurrency: a.salaryCurrency ?? null,
        salaryPeriod: a.salaryPeriod ?? null,
        postedAt: a.publishedAt?.toISOString() ?? null,
        originalUrl: a.originalUrl ?? null,
        applyUrl: null,
      })),
    });
  } catch (fehler) {
    /*
     * Die Meldung, nicht der Stapel.
     *
     * Ein Fehlerstapel nennt Dateipfade und Modulnamen — auf einem
     * Entwicklungsrechner harmlos, in einem Protokoll, das jemand
     * weiterschickt, nicht.
     */
    return NextResponse.json(
      { provider: "nomado24", error: fehler instanceof Error ? fehler.message : "unbekannt" },
      { status: 502 },
    );
  }
}
