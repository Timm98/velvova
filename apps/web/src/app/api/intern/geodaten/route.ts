import { NextResponse } from "next/server";
import { getDb } from "@paycheck/db";
import { geodatenNachziehen, geoAbdeckung } from "@paycheck/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Der Zeitplan ruft hier an — Koordinaten für neue Stellen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das nötig ist
 * ══════════════════════════════════════════════════════════════
 *
 * `geodatenNachziehen` lief einmal von Hand, für den damaligen
 * Bestand. Was danach importiert wurde, kam ohne Koordinaten an.
 *
 * Gemessen am 7. September 2026: von den 3.000 neuesten deutschen
 * Anzeigen hatten 330 Koordinaten — elf Prozent. Und die Liste zeigt
 * die neuesten. Umkreissuche, Fahrzeit und Entfernungsangabe waren
 * damit für neun von zehn sichtbaren Stellen blind.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier NICHT passiert
 * ══════════════════════════════════════════════════════════════
 *
 * Kein Modellaufruf, kein fremder Dienst, keine Adresse verlässt das
 * Haus. Aufgelöst wird gegen `geo_referenz` — eine Tabelle im eigenen
 * Bestand aus offenen Ortsdaten. Der Lauf kostet Rechenzeit und sonst
 * nichts, und er darf deshalb häufiger laufen als alles andere hier.
 */

/** Wie viele Stellen je Aufruf. */
const STAPEL = 500;

export async function POST(request: Request) {
  const geheimnis = process.env.JOBS_REFRESH_SECRET;
  const kopf = request.headers.get("authorization");
  if (!geheimnis || kopf !== `Bearer ${geheimnis}`) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 401 });
  }

  const url = new URL(request.url);
  const roh = Number(url.searchParams.get("stapel") ?? STAPEL);
  const stapel = Number.isFinite(roh) ? Math.max(1, Math.min(roh, 5000)) : STAPEL;

  const db = await getDb();

  /*
   * Alle offenen, nicht nur die analysierten.
   *
   * Das Skript nahm nur analysierte Stellen — richtig für einen
   * einmaligen Lauf über den Altbestand. Hier wäre es falsch: Eine
   * frisch importierte Stelle ist noch nicht analysiert und steht
   * trotzdem ganz oben in der Liste.
   */
  const befund = await geodatenNachziehen(db, { stapel, nurAnalysierte: false });

  const abdeckung = await geoAbdeckung(db)
    .then((a) => a.anteilAufgeloest)
    .catch(() => null);

  return NextResponse.json({ ...befund, abdeckung });
}
