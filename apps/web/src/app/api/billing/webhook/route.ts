import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
import { zahlungsanbieter } from "@/lib/billing/anbieter";
import type { PlanKey } from "@/lib/billing/plaene";

/**
 * Was der Zahlungsanbieter uns meldet.
 *
 * Das ist die einzige Stelle, an der ein Abo entsteht, sich ändert oder
 * endet. Nicht die Oberfläche, nicht der Kassengang, nicht eine
 * Server-Aktion nach erfolgreicher Weiterleitung — sondern die Meldung
 * des Anbieters, der das Geld tatsächlich gesehen hat.
 *
 * Der Grund ist nicht Ordnungsliebe. Eine Erfolgs-Weiterleitung bedeutet
 * nur, dass ein Browser irgendwo angekommen ist: sie lässt sich
 * aufrufen, ohne bezahlt zu haben, sie kommt manchmal nie an, weil
 * jemand das Fenster schliesst, und sie sagt nichts über eine
 * Rücklastschrift drei Tage später. Der Webhook sagt all das.
 *
 * **Ohne Anbieter ist diese Route zu.** Sie nimmt nichts entgegen, was
 * sie nicht prüfen kann — eine offene Adresse, die auf Zuruf Abos
 * anlegt, wäre die teuerste Sicherheitslücke, die dieses Produkt haben
 * könnte.
 *
 * **Ohne gültige Signatur ist sie ebenfalls zu.** Die Prüfung gehört
 * dem Anbieter: nur er kennt sein Verfahren und sein Geheimnis. Steht
 * hier später ein Anbieter, wird `signaturGueltig` an ihn delegiert.
 */

/** Die Ereignisse, auf die wir reagieren. Alle anderen quittieren wir
 *  freundlich und tun nichts — ein Anbieter schickt vieles. */
type Ereignis =
  | { art: "abo_aktiv"; userId: string; plan: PlanKey; beginn: Date; ende: Date; interval: "month" | "year"; providerRef: string }
  | { art: "abo_gekuendigt"; userId: string; zumZeitraumende: boolean }
  | { art: "zahlung_fehlgeschlagen"; userId: string }
  | { art: "abo_beendet"; userId: string };

export async function POST(request: NextRequest) {
  const anbieter = zahlungsanbieter();

  if (!anbieter.verfügbar()) {
    return NextResponse.json(
      { fehler: "Es ist kein Zahlungsanbieter verbunden." },
      { status: 503 },
    );
  }

  /*
   * Hier prüft später der Anbieter die Signatur über dem ROHEN Rumpf.
   *
   * Roh, nicht geparst: jede Umformung — auch `JSON.parse` und wieder
   * `JSON.stringify` — kann ein Byte verändern, und dann stimmt die
   * Signatur nicht mehr über dem, was tatsächlich ankam.
   */
  const roh = await request.text();
  const signatur = request.headers.get("x-signature") ?? "";
  const ereignis = await pruefeUndLies(roh, signatur);

  if (!ereignis) {
    return NextResponse.json({ fehler: "Signatur ungültig." }, { status: 400 });
  }

  await verarbeite(ereignis);

  /*
   * 200 auch für Ereignisse, die uns nicht interessieren.
   *
   * Ein Anbieter, der einen Fehlercode bekommt, versucht es erneut —
   * mit wachsendem Abstand, tagelang. Für ein Ereignis, das wir
   * absichtlich ignorieren, wäre das eine Warteschlange, die nie leer
   * wird.
   */
  return NextResponse.json({ ok: true });
}

/**
 * Signatur prüfen und in ein Ereignis übersetzen.
 *
 * Getrennt, weil hier zwei verschiedene Dinge passieren, die beide
 * anbieterabhängig sind — und weil eine Stelle, die „prüfen" heisst,
 * niemals nebenbei auch parsen sollte, ohne dass man es sieht.
 *
 * Solange kein Anbieter angeschlossen ist, gibt sie `null` zurück: kein
 * Ereignis ist gültig, wenn niemand seine Echtheit bestätigen kann.
 */
async function pruefeUndLies(_roh: string, _signatur: string): Promise<Ereignis | null> {
  return null;
}

/**
 * Das Ereignis in den Kontostand übersetzen.
 *
 * Bewusst ohne `withUser`: ein Webhook kommt vom Anbieter, nicht von
 * einer angemeldeten Person. Es gibt hier keine Sitzung, gegen die eine
 * Zeilenregel prüfen könnte — die Berechtigung ist die geprüfte
 * Signatur, und die liegt eine Funktion höher.
 */
async function verarbeite(e: Ereignis): Promise<void> {
  const db = await getDb();
  const jetzt = new Date();

  switch (e.art) {
    case "abo_aktiv": {
      const werte = {
        userId: e.userId,
        plan: e.plan,
        status: "active" as const,
        interval: e.interval,
        currentPeriodStart: e.beginn,
        currentPeriodEnd: e.ende,
        cancelAtPeriodEnd: false,
        provider: zahlungsanbieter().key,
        providerRef: e.providerRef,
        updatedAt: jetzt,
      };
      /*
       * Einfügen oder aktualisieren, nicht erst lesen und dann
       * schreiben. Ein Anbieter schickt dasselbe Ereignis mehrfach,
       * wenn er unsere Antwort nicht gesehen hat — zwei Zeilen für ein
       * Abo wären die Folge, und welche davon gilt, wüsste niemand.
       */
      await db
        .insert(schema.subscriptions)
        .values(werte)
        .onConflictDoUpdate({ target: schema.subscriptions.userId, set: werte });
      break;
    }

    case "abo_gekuendigt":
      // Gekündigt heisst nicht beendet: der Zugang läuft bis zum Ende
      // des bezahlten Zeitraums weiter. Siehe `giltNoch` in zugang.ts.
      await db
        .update(schema.subscriptions)
        .set({ cancelAtPeriodEnd: e.zumZeitraumende, updatedAt: jetzt })
        .where(eq(schema.subscriptions.userId, e.userId));
      break;

    case "zahlung_fehlgeschlagen":
      await db
        .update(schema.subscriptions)
        .set({ status: "past_due", updatedAt: jetzt })
        .where(eq(schema.subscriptions.userId, e.userId));
      break;

    case "abo_beendet":
      await db
        .update(schema.subscriptions)
        .set({ status: "canceled", updatedAt: jetzt })
        .where(eq(schema.subscriptions.userId, e.userId));
      break;
  }
}

export const dynamic = "force-dynamic";
