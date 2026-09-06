import { NextResponse } from "next/server";
import { getDb } from "@paycheck/db";
import { ereignisAufnehmen, gemeldeterZeitpunkt, proaktivLauf } from "@paycheck/jobs";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Der Browser meldet, was geschehen ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum alles hier misstrauisch behandelt wird
 * ══════════════════════════════════════════════════════════════
 *
 * Was hier ankommt, ist nicht das, was passiert ist — es ist das, was
 * jemand geschickt hat. Die Kennung des Nutzers kommt deshalb aus der
 * Sitzung und niemals aus dem Rumpf: Stünde sie im JSON, könnte jeder
 * Ereignisse in fremde Konten schreiben und darüber steuern, was Nina
 * einem anderen Menschen vorschlägt.
 *
 * Die Ereignisart wird gegen eine geschlossene Liste geprüft, der
 * Kontext auf Zahlen und kurze Zeichenketten reduziert. Beides
 * geschieht in `ereignisAufnehmen`, nicht hier — damit die
 * Sprachausgabe und ein späterer zweiter Zugang dieselbe Prüfung
 * bekommen und nicht ihre eigene.
 */

/** Wie viele Ereignisse eine Meldung tragen darf. */
const STAPEL_MAX = 40;

interface Rumpf {
  ereignisse?: unknown;
  sitzungId?: unknown;
  /** Ob nach der Aufnahme ein Durchgang laufen soll. */
  auswerten?: unknown;
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireUser();

  let rumpf: Rumpf;
  try {
    rumpf = (await request.json()) as Rumpf;
  } catch {
    return NextResponse.json({ fehler: "kein_json" }, { status: 400 });
  }

  const liste = Array.isArray(rumpf.ereignisse) ? rumpf.ereignisse : [];
  if (liste.length === 0) return NextResponse.json({ fehler: "leer" }, { status: 400 });
  if (liste.length > STAPEL_MAX)
    return NextResponse.json({ fehler: "zu_viele" }, { status: 413 });

  const sitzungId = typeof rumpf.sitzungId === "string" ? rumpf.sitzungId.slice(0, 64) : null;
  const db = await getDb();

  let neu = 0;
  let doppelt = 0;
  const abgewiesen: string[] = [];

  for (const roh of liste) {
    if (typeof roh !== "object" || roh === null) {
      abgewiesen.push("kein_objekt");
      continue;
    }
    const e = roh as Record<string, unknown>;

    /*
     * Der Zeitpunkt darf aus dem Browser kommen — begrenzt. Die Regel
     * steht in `gemeldeterZeitpunkt`, damit die Sprachausgabe und ein
     * späterer zweiter Zugang dieselbe bekommen.
     */
    const geschehenAm = gemeldeterZeitpunkt(e.geschehenAm, new Date());

    const befund = await ereignisAufnehmen(db, user.id, {
      art: typeof e.art === "string" ? e.art : "",
      jobId: typeof e.jobId === "string" ? e.jobId : null,
      auftragId: typeof e.auftragId === "string" ? e.auftragId : null,
      sitzungId,
      geschehenAm,
      kontext: typeof e.kontext === "object" && e.kontext !== null
        ? (e.kontext as Record<string, unknown>)
        : {},
      quelle: e.quelle === "voice" ? "voice" : "app",
    });

    if (!befund.ok) abgewiesen.push(befund.grund);
    else if (befund.neu) neu++;
    else doppelt++;
  }

  /*
   * Der Durchgang läuft nur auf Wunsch.
   *
   * Bei jedem Klick zu prüfen, ob Nina etwas sagen möchte, wäre eine
   * Datenbankrunde je Mausbewegung. Der Browser bündelt und bittet
   * am Ende einer Ansicht um die Auswertung.
   */
  const befund =
    rumpf.auswerten === true
      ? await proaktivLauf(db, user.id, { sitzungId })
      : null;

  return NextResponse.json({
    aufgenommen: neu,
    doppelt,
    abgewiesen,
    proaktiv: befund,
  });
}
