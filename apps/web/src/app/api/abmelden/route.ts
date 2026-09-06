import { NextResponse, type NextRequest } from "next/server";
import { abmelden } from "@/lib/suchauftrag/abmeldung";

export const dynamic = "force-dynamic";

/**
 * Der Ein-Klick-Weg nach RFC 8058.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nur POST
 * ══════════════════════════════════════════════════════════════
 *
 * Ein GET, das abmeldet, meldet Menschen ab, die nie geklickt haben:
 * Virenscanner und Vorschaudienste holen jede Adresse in einer Mail
 * ab. Die Bestätigungsseite unter `/abmelden` zeigt deshalb einen
 * Knopf, und dieser Endpunkt nimmt nur POST.
 *
 * Postfachanbieter, die den eigenen Abmeldeknopf anzeigen, schicken
 * ebenfalls POST — das ist die Handlung eines Menschen in seiner
 * Oberfläche, nicht die eines Scanners.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Antwort immer gleich aussieht
 * ══════════════════════════════════════════════════════════════
 *
 * Ein unbekanntes Token bekommt dieselbe Antwort wie ein gültiges.
 * Sonst wäre dieser Endpunkt ein Weg, gültige Token zu erraten — man
 * probiert, bis die Antwort sich ändert.
 */
export async function POST(request: NextRequest) {
  /*
   * Das Token darf aus der Adresse oder aus dem Formular kommen.
   *
   * Anbieter schicken es nach RFC 8058 an die Adresse aus
   * `List-Unsubscribe`; die Bestätigungsseite schickt ein Formular.
   */
  let token = request.nextUrl.searchParams.get("t")?.trim() ?? "";
  if (token === "") {
    try {
      const daten = await request.formData();
      token = String(daten.get("t") ?? "").trim();
    } catch {
      /* Kein Formular — dann eben kein Token. */
    }
  }

  if (token !== "") await abmelden(token);

  /*
   * 200 und ein kurzer Text. Der Anbieter erwartet eine Antwort, kein
   * Weiterleiten — und wir sagen nicht, ob das Token etwas getroffen
   * hat.
   */
  return new NextResponse("Abgemeldet.", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * GET beantwortet die Frage, ohne sie zu beantworten.
 *
 * Ein Scanner, der hier landet, bekommt eine Weiterleitung auf die
 * Bestätigungsseite und ändert nichts.
 */
export function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const ziel = new URL("/abmelden", request.nextUrl.origin);
  if (token) ziel.searchParams.set("t", token);
  return NextResponse.redirect(ziel, { status: 303 });
}
