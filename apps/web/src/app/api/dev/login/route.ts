import { NextResponse } from "next/server";
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
 * Zwei Riegel, beide notwendig:
 *  - nur ausserhalb von Produktion
 *  - nur mit dem lokalen PGlite-Treiber
 *
 * Gegen einen echten Postgres-Server oder in Produktion antwortet der
 * Endpunkt mit 404, als gaebe es ihn nicht.
 */

type SessionResult =
  | { ok: true; token: string; cookieName: string; ttlDays: number }
  | { ok: false; status: number; message: string };

async function createDemoSession(): Promise<SessionResult> {
  const cfg = loadRuntimeConfig();

  if (cfg.nodeEnv === "production" || cfg.db.driver !== "pglite") {
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
 * Das Cookie wird ausdrücklich auf die zurueckgegebene Antwort gesetzt.
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
  const result = await createDemoSession();
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
  const result = await createDemoSession();
  if (!result.ok) return NextResponse.json({ fehler: result.message }, { status: result.status });

  // Relative Weiterleitung statt absoluter URL. Next meldet in
  // request.url immer "localhost" - eine daraus gebaute absolute Adresse
  // würde den Host wechseln und das gerade gesetzte Cookie entwerten.
  // Ein relatives Location-Feld ist nach RFC 7231 zulässig und behält
  // den Host der Anfrage.
  const response = new NextResponse(null, { status: 307, headers: { Location: "/app" } });
  return attachCookie(response, result.cookieName, result.token, result.ttlDays);
}
