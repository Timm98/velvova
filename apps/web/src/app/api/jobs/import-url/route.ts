import { lookup } from "node:dns/promises";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
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
    return NextResponse.json({
      modus: "bookmark",
      quelle: eintrag?.displayName ?? url.hostname,
      entscheidung: entscheidung.decision,
      grund: entscheidung.reason,
      hinweis:
        "Von dieser Quelle rufen wir nichts ab. Die Adresse ist als privates Lesezeichen " +
        "gespeichert. Wenn du den Anzeigentext einfügst, analysiert Nina ihn — was du selbst " +
        "liest und mitbringst, bleibt deine Sache und bleibt privat.",
      url: url.href,
    });
  }

  // 3. Abrufen — und zwar gegen die geprüfte Adresse.
  const ergebnis = await importFromUrl(user.id, url, sicher.addresses ?? []);

  return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : 502 });
}
