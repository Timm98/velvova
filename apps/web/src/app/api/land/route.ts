import { NextResponse, type NextRequest } from "next/server";
import { LAND_COOKIE } from "@/lib/herkunft";

export const dynamic = "force-dynamic";

/**
 * Das Land von Hand setzen.
 *
 * ── Warum als Route und nicht als Serveraktion ────────────────
 *
 * Eine Serveraktion braucht JavaScript. Der Länderschalter steht auf
 * einer Landingpage, die ohne JavaScript vollständig funktionieren soll
 * — es ist die eine Seite, die auch dann noch etwas taugen muss, wenn
 * ein Bündel nicht lädt oder jemand Skripte blockiert.
 *
 * Ein gewöhnlicher Verweis auf diese Route setzt das Cookie und schickt
 * zurück. Das funktioniert immer.
 *
 * ── Was gespeichert wird ──────────────────────────────────────
 *
 * Zwei Buchstaben, ein Jahr lang, ohne Kennung. Kein Profil, kein
 * Abgleich mit einem Konto, keine IP. Wer das Cookie löscht, bekommt
 * wieder die Vermutung aus der Netz-Kopfzeile.
 */
export async function GET(request: NextRequest) {
  const gewuenscht = request.nextUrl.searchParams.get("code")?.trim().toUpperCase() ?? "";
  const zurueck = request.nextUrl.searchParams.get("zurueck") ?? "/";

  /*
   * Das Ziel muss ein Pfad auf dieser Anwendung sein.
   *
   * Ein durchgereichtes Ziel ist die klassische offene Weiterleitung:
   * ein Link auf unsere eigene Domain, der auf einer fremden landet, ist
   * ein fertiger Phishing-Bauplan.
   */
  const sicher =
    zurueck.startsWith("/") && !zurueck.startsWith("//") && !/[\r\n]/.test(zurueck)
      ? zurueck.slice(0, 200)
      : "/";

  const antwort = NextResponse.redirect(new URL(sicher, request.url));

  if (/^[A-Z]{2}$/.test(gewuenscht)) {
    antwort.cookies.set(LAND_COOKIE, gewuenscht, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false,
      secure: request.nextUrl.protocol === "https:",
    });
  } else {
    /* Ein leerer oder unsinniger Code hebt die Wahl auf. */
    antwort.cookies.delete(LAND_COOKIE);
  }

  return antwort;
}
