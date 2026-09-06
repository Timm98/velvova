import { NextResponse, type NextRequest } from "next/server";
import { loadRuntimeConfig } from "@paycheck/config";
import { getDb } from "@paycheck/db";
import { zustellereignisBuchen } from "@paycheck/jobs";
import { signaturPruefen } from "@/lib/suchauftrag/webhooksignatur";

export const dynamic = "force-dynamic";

/**
 * Zustellereignisse des Mailanbieters.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier alles schiefgehen darf, ohne dass etwas kaputtgeht
 * ══════════════════════════════════════════════════════════════
 *
 * Webhooks kommen doppelt, verspätet und in falscher Reihenfolge. Das
 * ist kein Fehler des Anbieters, sondern die Natur der Sache — er
 * wiederholt, bis er eine 2xx sieht.
 *
 * Deshalb drei Vorkehrungen, jede an ihrer Stelle:
 *
 *   Signatur      hier — sonst kann jeder Ereignisse erfinden
 *   Entdoppelung  in `zustellEreignisse`, über die Anbieterkennung
 *   Reihenfolge   in `zustellereignisBuchen`, als geordnete Zustände
 *
 * Die dritte ist die, an die man zuletzt denkt: Ein `delivered`, das
 * nach einem `bounced` eintrifft, darf den Bounce nicht aufheben —
 * sonst wird aus einer toten Adresse wieder eine, an die geschrieben
 * wird.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Antwort fast immer 200 ist
 * ══════════════════════════════════════════════════════════════
 *
 * Ein 500 lässt den Anbieter wiederholen. Bei einem Ereignis, das wir
 * ohnehin nicht verarbeiten können — unbekannter Typ, kein passender
 * Ausgang —, wäre das eine Schleife ohne Ziel.
 *
 * Ausgenommen ist die Signatur: Ein unsigniertes oder falsch
 * signiertes Ereignis bekommt 401 und wird nicht angesehen.
 */

/** Wie der Anbieter seine Ereignisse nennt, und wie wir sie nennen. */
const ARTEN: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
  "email.clicked": "clicked",
};

export async function POST(request: NextRequest) {
  /*
   * Der Rumpf wird als Text gelesen, nicht als JSON.
   *
   * Signiert ist der Text, Byte für Byte. Wer ihn erst parst und dann
   * wieder ausgibt, prüft die Signatur gegen etwas anderes als das,
   * was angekommen ist — und lehnt dann gültige Ereignisse ab, sobald
   * ein Schlüssel anders sortiert oder ein Leerzeichen anders steht.
   */
  const rumpf = await request.text();
  const cfg = loadRuntimeConfig();

  const befund = signaturPruefen(
    rumpf,
    {
      id: request.headers.get("svix-id"),
      zeitstempel: request.headers.get("svix-timestamp"),
      signatur: request.headers.get("svix-signature"),
    },
    cfg.mail.webhookSecret,
  );

  if (!befund.ok) {
    /*
     * Der Grund geht ins Serverprotokoll, nicht in die Antwort.
     *
     * „Geheimnis fehlt" gegenüber „Signatur falsch" ist für den
     * Betrieb eine wichtige Unterscheidung und für einen fremden
     * Aufrufer eine Auskunft über die Konfiguration.
     */
    console.warn(`[mail-webhook] abgewiesen: ${befund.grund}`);
    return new NextResponse("unauthorized", { status: 401 });
  }

  let ereignis: { type?: string; created_at?: string; data?: { email_id?: string } };
  try {
    ereignis = JSON.parse(rumpf);
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }

  const art = ARTEN[ereignis.type ?? ""];
  if (!art) {
    /* Unbekannter Typ: angenommen, nicht verarbeitet. Eine
       Wiederholung würde daran nichts ändern. */
    return NextResponse.json({ ok: true, ignoriert: ereignis.type ?? null });
  }

  const db = await getDb();
  const gebucht = await zustellereignisBuchen(db, {
    /* Die Kennung des Anbieters ist der Entdoppelungsschlüssel. */
    anbieterEreignisId: request.headers.get("svix-id"),
    anbieterId: ereignis.data?.email_id ?? null,
    art,
    /*
     * Die Nutzlast des Anbieters wird nicht gespeichert.
     *
     * Sie trägt die Empfängeradresse und je nach Ereignis Betreff,
     * Zeitpunkt und Klickziel. Für die Zustandsführung brauchen wir
     * nichts davon — und was nicht gespeichert wird, kann nicht
     * durchsickern.
     */
    nutzlast: {},
    ereignisAm: ereignis.created_at ? new Date(ereignis.created_at) : null,
  });

  return NextResponse.json({ ok: true, ...gebucht });
}
