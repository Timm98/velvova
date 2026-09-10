import { bestandszahl } from "@/lib/jobs/bestandszahl";

/**
 * Der aktuelle Bestand als Zahl.
 *
 * Damit gleicht sich der Live-Zähler auf der Startseite ab, statt
 * beliebig weit hochzurechnen. Öffentlich, weil die Zahl ohnehin auf
 * jeder Seite steht — sie verrät nichts, was nicht sichtbar wäre.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const b = await bestandszahl();
  return Response.json(
    /*
     * `stand` gehört dazu.
     *
     * Der Zähler im Composer klappt einen Kasten auf, in dem steht,
     * wann zuletzt gezählt wurde. Ohne dieses Feld las er `undefined`
     * und schrieb „Zeitpunkt unbekannt" in Rot — eine Fehlermeldung
     * über eine Zahl, die stimmte.
     */
    { genau: b.genau, proSekunde: b.proSekunde, stand: b.stand },
    { headers: { "Cache-Control": "no-store" } },
  );
}
