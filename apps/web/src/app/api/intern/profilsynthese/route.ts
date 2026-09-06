import { NextResponse } from "next/server";
import { loadRuntimeConfig } from "@paycheck/config";
import { getDb } from "@paycheck/db";
import { hintergrundSynthese, MODELLAUFRUFE_MAX, STAPEL } from "@paycheck/jobs";
import {
  AiNotConfiguredError,
  modellFuer,
  preistafel,
  profilsyntheseRufer,
  PROFILSYNTHESE_FASSUNG,
  selectProvider,
} from "@paycheck/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Der Zeitplan ruft hier an — für Ninas Profilsynthese.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Endpunkt und nicht der Arbeiter
 * ══════════════════════════════════════════════════════════════
 *
 * `apps/worker` läuft in der Entwicklung. Im Betrieb läuft er nicht:
 * Dort ist die Anwendung ein Serverless-Dienst, und ein Prozess mit
 * `setInterval` hat darin keinen Platz.
 *
 * Der Stellenabruf und der Suchauftrag lösen das seit Monaten so:
 * Wecker in GitHub Actions, Arbeit im Server, ein gemeinsames
 * Geheimnis dazwischen. Ein drittes Verfahren daneben wäre ein
 * dritter Ort, an dem man nachsieht, warum nichts lief.
 *
 * Der Arbeiter behält seine Aufgabe trotzdem — dieselbe Funktion,
 * derselbe Rufer. In der Entwicklung ist er der bequemere Weg.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum stündlich und nicht öfter
 * ══════════════════════════════════════════════════════════════
 *
 * Weil die Fälligkeitsregel ohnehin frühestens nach zehn Minuten und
 * ab fünf neuen Belegen greift. Ein Lauf alle fünf Minuten fände
 * dasselbe wie der stündliche — nur zwölfmal so oft nichts.
 *
 * ── Und warum doppelte Läufe nichts kaputtmachen ────────────
 *
 * Der Anspruch je Profil liegt als Zeile in `profil_laeufe` mit
 * einem eindeutigen Index auf dem Zustand `laeuft`. Zwei gleichzeitige
 * Läufe greifen dasselbe Profil, und genau einer bekommt es.
 */
export async function POST(request: Request) {
  const geheimnis = process.env.JOBS_REFRESH_SECRET;
  const kopf = request.headers.get("authorization");
  if (!geheimnis || kopf !== `Bearer ${geheimnis}`) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 401 });
  }

  const url = new URL(request.url);
  const stapel = Number(url.searchParams.get("stapel") ?? STAPEL);
  const budget = Number(url.searchParams.get("budget") ?? MODELLAUFRUFE_MAX);

  const cfg = loadRuntimeConfig();

  let provider;
  try {
    provider = await selectProvider(cfg);
  } catch (fehler) {
    if (fehler instanceof AiNotConfiguredError) {
      /*
       * 200 und ein ehrlicher Grund, kein Fehlerstatus.
       *
       * Ein Zeitplan, der jede Stunde rot blinkt, weil ein Schlüssel
       * fehlt, wird nach zwei Tagen stummgeschaltet — und dann fällt
       * der echte Fehlschlag niemandem mehr auf.
       */
      return NextResponse.json({ aktiv: false, grund: "kein Anbieter konfiguriert" });
    }
    throw fehler;
  }

  const db = await getDb();
  const { tafel, hinterlegt } = preistafel();

  const befund = await hintergrundSynthese(db, {
    stapel: Number.isFinite(stapel) ? stapel : STAPEL,
    modellaufrufeMax: Number.isFinite(budget) ? budget : MODELLAUFRUFE_MAX,
    promptFassung: PROFILSYNTHESE_FASSUNG,
    rufer: profilsyntheseRufer(provider, tafel, hinterlegt),
  });

  /*
   * Die Zahlen gehen mit hinaus, die Inhalte nicht.
   *
   * Wer den Zeitplan beobachtet, will wissen: Wie viele standen an,
   * wie viele liefen durch, was hat es gekostet. Was in den Profilen
   * steht, geht ihn nichts an — und ein Protokoll ist der schlechteste
   * Ort für alles, was jemand über sich preisgegeben hat.
   */
  return NextResponse.json({
    aktiv: true,
    modell: modellFuer(cfg, "DEEP").modell,
    preise: hinterlegt ? "hinterlegt" : "geschätzt",
    ...befund,
  });
}
