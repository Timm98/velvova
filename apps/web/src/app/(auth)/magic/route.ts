import { NextResponse, type NextRequest } from "next/server";
import { loadRuntimeConfig } from "@paycheck/config";
import { consumeMagicLink, createSession } from "@/lib/auth";
import { absender, prüfeGrenze } from "@/lib/rate-limit";

/**
 * Der Einlöseweg für den Anmeldelink.
 *
 * ── Was hier gefehlt hat ──────────────────────────────────────
 *
 * `createMagicLink` erzeugte ein Token, die Oberfläche meldete
 * „gesendet" — und es gab keine einzige Stelle, an der ein Token
 * eingelöst werden konnte. `consumeMagicLink` stand fertig im Code,
 * ohne Aufrufer. „Link per E-Mail senden" und „Passwort vergessen"
 * führten damit beide ins Nichts: Wer sein Passwort vergessen hatte,
 * kam nicht mehr an sein Konto.
 *
 * ── Warum das Token in der Adresse steht ──────────────────────
 *
 * Ein Anmeldelink aus einer E-Mail kann nur ein GET sein. Deshalb:
 * einmalig gültig, zwanzig Minuten, `consumed_at` wird beim ersten
 * Einlösen gesetzt. Ein abgefangener Link ist damit spätestens nach
 * der ersten Benutzung wertlos.
 *
 * `no-referrer` verhindert, dass das Token über den Referer an die
 * nächste Seite weitergereicht wird.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  /*
   * Erraten kosten lassen.
   *
   * Das Token hat 256 Bit; Raten ist aussichtslos. Die Grenze schützt
   * nicht davor, sondern davor, dass jemand den Endpunkt benutzt, um
   * die Datenbank mit Abfragen zu beschäftigen.
   */
  const grenze = prüfeGrenze(`magic:${absender(request)}`, { anzahl: 10, fensterMs: 60_000 });
  if (!grenze.erlaubt) {
    return NextResponse.redirect(new URL("/login?fehler=zu_viele", request.url), {
      status: 303,
      headers: { "Referrer-Policy": "no-referrer" },
    });
  }

  const token = request.nextUrl.searchParams.get("token");
  const userId = token ? await consumeMagicLink(token) : null;

  if (!userId) {
    /*
     * Ein Grund, aber kein verräterischer.
     *
     * „abgelaufen" gilt für abgelaufen, verbraucht und erfunden
     * gleichermassen — sonst liesse sich am Unterschied ablesen, ob ein
     * Token je gültig war.
     */
    return NextResponse.redirect(new URL("/login?fehler=link_abgelaufen", request.url), {
      status: 303,
      headers: { "Referrer-Policy": "no-referrer" },
    });
  }

  await createSession(userId, request.headers.get("user-agent") ?? undefined);

  const ziel = loadRuntimeConfig().nodeEnv === "test" ? "/app" : "/app";
  return NextResponse.redirect(new URL(ziel, request.url), {
    status: 303,
    headers: { "Referrer-Policy": "no-referrer" },
  });
}
