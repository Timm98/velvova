import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { loadRuntimeConfig } from "@paycheck/config";
import { getDb, schema } from "@paycheck/db";
import { and, eq, isNull } from "drizzle-orm";
import { issueSessionToken } from "@/lib/auth";

/**
 * Anmeldung der Demo-Persona ohne Passwort.
 *
 * Der Grund für diesen Weg: PGlite ist eine eingebettete
 * Einzelprozess-Datenbank. Ein Skript, das von aussen eine Sitzung
 * anlegt, schreibt in eine andere Instanz als der laufende Server - die
 * Sitzung wäre unsichtbar. Deshalb muss sie im Serverprozess entstehen.
 *
 * Drei Riegel, alle notwendig:
 *  - nur ausserhalb von Produktion
 *  - nur mit ausdrücklich gesetztem DEV_LOGIN_ENABLED=true
 *  - nur über einen Loopback-Host
 *
 * Vorher war der zweite Riegel „nur PGlite". Der Gedanke dahinter war
 * richtig — ein passwortloser Anmeldeendpunkt darf keinesfalls gegen
 * eine echte Datenbank laufen. Nur ist die lokale Entwicklung seit dem
 * Umzug auf Supabase selbst Postgres. Der Riegel traf damit nicht mehr
 * die Gefahr, sondern den Normalfall: sämtliche E2E-Tests mit
 * Anmeldung liefen ins 404 und konnten nichts mehr prüfen.
 *
 * Der Ersatz ist enger, nicht weiter. „PGlite" war eine Vermutung über
 * die Absicht; ein Schalter, der nirgends gesetzt ist, ausser jemand
 * setzt ihn selbst, ist die Absicht. Auf einer gehosteten Umgebung mit
 * NODE_ENV != production bleibt der Endpunkt unsichtbar, solange
 * niemand die Variable setzt — und selbst dann antwortet er nur, wenn
 * die Anfrage von diesem Rechner kommt.
 *
 * In allen anderen Fällen antwortet er mit 404, als gäbe es ihn nicht.
 */

type SessionResult =
  | { ok: true; token: string; cookieName: string; ttlDays: number }
  | { ok: false; status: number; message: string };

/** Kommt die Anfrage von diesem Rechner? */
function vonLoopback(host: string | null): boolean {
  if (!host) return false;
  const name = host.replace(/:\d+$/, "").toLowerCase();
  return name === "localhost" || name === "127.0.0.1" || name === "[::1]" || name === "::1";
}

async function createDemoSession(host: string | null): Promise<SessionResult> {
  const cfg = loadRuntimeConfig();

  const erlaubt =
    cfg.nodeEnv !== "production" &&
    process.env.DEV_LOGIN_ENABLED === "true" &&
    vonLoopback(host);

  if (!erlaubt) {
    return { ok: false, status: 404, message: "Nicht gefunden" };
  }

  const db = await getDb(cfg);
  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.email, "lea.demo@example.invalid"), isNull(schema.users.deletedAt)))
    .limit(1);

  if (!user) {
    return {
      ok: false,
      status: 404,
      message: 'Demo-Persona nicht gefunden. Zuerst "pnpm db:seed" ausführen.',
    };
  }

  const token = await issueSessionToken(user.id, "Lokale Entwicklung");
  return { ok: true, token, cookieName: cfg.auth.cookieName, ttlDays: 30 };
}

/**
 * Das Cookie wird ausdrücklich auf die zurückgegebene Antwort gesetzt.
 * Ueber cookies().set() gesetzte Werte landen NICHT auf einer selbst
 * konstruierten NextResponse - genau daran ist die erste Fassung
 * gescheitert, und der Test hat es aufgedeckt.
 */
function attachCookie(response: NextResponse, name: string, token: string, ttlDays: number): NextResponse {
  response.cookies.set(name, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: ttlDays * 86_400,
  });
  return response;
}

export async function POST(): Promise<NextResponse> {
  const result = await createDemoSession((await headers()).get("host"));
  if (!result.ok) return NextResponse.json({ fehler: result.message }, { status: result.status });

  return attachCookie(
    NextResponse.json({ angemeldet: "lea.demo@example.invalid" }),
    result.cookieName,
    result.token,
    result.ttlDays,
  );
}

/** Bequemer Einstieg im Browser: /api/dev/login öffnen und in der App landen. */
export async function GET(): Promise<NextResponse> {
  const result = await createDemoSession((await headers()).get("host"));
  if (!result.ok) return NextResponse.json({ fehler: result.message }, { status: result.status });

  // Relative Weiterleitung statt absoluter URL. Next meldet in
  // request.url immer "localhost" - eine daraus gebaute absolute Adresse
  // würde den Host wechseln und das gerade gesetzte Cookie entwerten.
  // Ein relatives Location-Feld ist nach RFC 7231 zulässig und behält
  // den Host der Anfrage.
  //
  // ── Warum /app/monday und nicht /app ────────────────────────────
  //
  // Weil `/app` keine Seite mehr ist. Es gab dort einmal eine zweite
  // Startseite für Angemeldete; die wurde abgeschafft, weil die
  // Startseite für beide dieselbe ist. Seitdem antwortet `/app` mit
  // einer Weiterleitung auf `/`.
  //
  // Die Kette lautete also: dieser Endpunkt → /app → /. Das Cookie war
  // gesetzt, die Anmeldung hatte funktioniert, und der Mensch stand
  // auf der öffentlichen Startseite.
  //
  // In der Testreihe war es genau derselbe Weg, nur sichtbarer:
  // `loginAsDemo` wartet auf eine Adresse unter `/app` und lief in die
  // Zeitgrenze von zwei Minuten. Danach scheiterte JEDER Fall, der
  // eine Anmeldung braucht — an einer Weiterleitung, nicht an dem,
  // was er prüfen wollte.
  //
  // `/app/monday` ist dasselbe Ziel, das die Registrierung nach dem
  // Anlegen eines Kontos ansteuert.
  const response = new NextResponse(null, { status: 307, headers: { Location: "/app/monday" } });
  return attachCookie(response, result.cookieName, result.token, result.ttlDays);
}
