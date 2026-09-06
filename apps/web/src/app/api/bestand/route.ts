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
    { genau: b.genau, proSekunde: b.proSekunde },
    { headers: { "Cache-Control": "no-store" } },
  );
}
