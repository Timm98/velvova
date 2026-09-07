import { lookup } from "node:dns/promises";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
import {
  analysiereLink,
  decideForUrl,
  findByUrl,
  isAllowed,
  verifyUrl,
  type UrlVerdict,
} from "@paycheck/sources";
import { requireUser } from "@/lib/auth";
import { importFromUrl } from "@/lib/jobImport";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * „Diesen Job-Link analysieren“.
 *
 * Der Weg, auf dem eine Anzeige aus einer Quelle ins System kommt, mit
 * der wir keinen Vertrag haben — und er ist zulässig, weil die Person
 * die Anzeige selbst mitbringt.
 *
 * Drei Fälle, drei verschiedene Antworten:
 *
 *   **Freigegebene Quelle.** Die Anzeige wird abgerufen und normal
 *   verarbeitet.
 *
 *   **Nicht freigegebene Quelle.** Es wird NICHTS abgerufen. Die
 *   Adresse wird als privates Lesezeichen gespeichert, und die Person
 *   wird gebeten, den Text selbst einzufügen. Das ist kein
 *   Umweg um die Regel, sondern ihre Einhaltung: was die Person selbst
 *   liest und weitergibt, ist ihre Sache.
 *
 *   **Unbekannte Quelle.** Wie oben. Unbekannt heisst ungeprüft, nicht
 *   erlaubt.
 *
 * Vor jedem Abruf steht die SSRF-Prüfung. Eine vom Nutzer eingegebene
 * Adresse, die der Server holt, ist sonst der kürzeste Weg zum
 * Metadatendienst der Maschine.
 */

const Body = z.object({
  url: z.string().min(1).max(2048),
});

export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireUser();

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ fehler: "Es fehlt eine Adresse." }, { status: 400 });
  }

  // 1. Darf der Server diese Adresse überhaupt anfassen?
  const sicher: UrlVerdict = await verifyUrl(parsed.data.url, async (host) => {
    const treffer = await lookup(host, { all: true });
    return treffer.map((t) => t.address);
  });

  if (!sicher.ok) {
    return NextResponse.json(
      { fehler: sicher.message, grund: sicher.reason },
      { status: 400 },
    );
  }

  const url = sicher.url!;

  // 2. Darf diese QUELLE gelesen werden? Die Reihenfolge ist Absicht:
  //    die technische Prüfung sagt „erreichbar“, die rechtliche sagt
  //    „erlaubt“. Nur beide zusammen ergeben einen Abruf.
  const entscheidung = decideForUrl(url.href);
  const eintrag = findByUrl(url.href);

  if (!isAllowed(entscheidung, "FetchDetails")) {
    /*
     * Bevor wir „geht nicht" sagen: gibt es die Stelle beim
     * Arbeitgeber selbst?
     *
     * Viele Plattform-Adressen tragen Titel und Arbeitgeber im Pfad.
     * Das zu LESEN ist kein Zugriff auf die Plattform — die Adresse hat
     * die Person selbst mitgebracht. Steht der Arbeitgeber in den
     * registrierten Boards, gibt es eine freigegebene Originalquelle,
     * und die dürfen wir lesen.
     *
     * Was hier ausdrücklich NICHT passiert: aus dem Namen einen
     * Board-Bezeichner bauen und durchprobieren. Die Quellenliste sagt
     * zu jedem ATS-Eintrag „nie aus einer Suche"; Bezeichner zu erraten
     * wäre Aufzählung fremder Systeme.
     */
    const db = await getDb();
    const boards = await db
      .select({
        employerName: schema.employerBoards.employerName,
        board: schema.employerBoards.board,
        boardToken: schema.employerBoards.boardToken,
      })
      .from(schema.employerBoards)
      .where(eq(schema.employerBoards.enabled, true))
      .catch(() => []);

    const analyse = analysiereLink(url.href, boards);

    return NextResponse.json({
      modus: "bookmark",
      quelle: eintrag?.displayName ?? url.hostname,
      entscheidung: entscheidung.decision,
      linkModus: analyse.modus,
      erkannterTitel: analyse.vermuteterTitel,
      erkannterArbeitgeber: analyse.vermuteterArbeitgeber,
      grund: entscheidung.reason,
      hinweis:
        analyse.modus === "canonical_employer_source"
          ? analyse.hinweis
          : "Von dieser Quelle rufen wir nichts ab. Die Adresse ist als privates Lesezeichen " +
            "gespeichert. Wenn du den Anzeigentext einfügst, analysiert Monday ihn — was du selbst " +
            "liest und mitbringst, bleibt deine Sache und bleibt privat.",
      url: url.href,
    });
  }

  // 3. Abrufen — und zwar gegen die geprüfte Adresse.
  const ergebnis = await importFromUrl(user.id, url, sicher.addresses ?? []);

  return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : 502 });
}
