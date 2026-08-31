import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { loadRuntimeConfig } from "@paycheck/config";
import { getDb, schema, withUser } from "@paycheck/db";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

/**
 * Authentifizierung.
 *
 * Bewusst ohne fremde Auth-Bibliothek: der Umfang ist klein (E-Mail und
 * Passwort, Magic Link, Sitzungen), und jede Bibliothek wäre eine
 * Abhängigkeit an genau der Stelle, an der später ein Betreiber
 * eigene Anforderungen hat. Die Entscheidung steht in docs/adr/0004.
 *
 * Grundsätze:
 *  - Im Cookie steht ein zufälliges Token, in der Datenbank nur sein Hash.
 *  - Passwörter mit scrypt, Vergleich in konstanter Zeit.
 *  - Antwortverhalten verrät nicht, ob eine Adresse existiert.
 */

const SESSION_TTL_DAYS = 30;
const MIN_PASSWORD_LENGTH = 12;

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  role: "candidate" | "operator" | "admin";
  locale: "de" | "en";
}

// --- Passwörter ---------------------------------------------------------

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(plain, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export function verifyPassword(plain: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  const actual = scryptSync(plain, salt, expected.length, { N: 16384, r: 8, p: 1 });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export interface PasswordCheck {
  ok: boolean;
  reason?: "too_short";
}

export function checkPassword(plain: string): PasswordCheck {
  // Länge statt Zeichenklassen. Erzwungene Sonderzeichen erzeugen
  // vorhersehbare Muster und schlechter merkbare Passwörter.
  if (plain.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: "too_short" };
  return { ok: true };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

// --- Sitzungen -----------------------------------------------------------

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Legt eine Sitzung an und gibt das Token zurück, ohne ein Cookie zu
 * setzen. Getrennt von createSession, weil Route Handler das Cookie
 * ausdrücklich auf ihre eigene Antwort setzen müssen - über cookies()
 * gesetzte Werte landen nicht auf einer selbst gebauten NextResponse.
 */
/**
 * Darf das Sitzungscookie `Secure` tragen?
 *
 * `Secure` heißt: der Browser sendet das Cookie ausschließlich über
 * TLS. In Produktion ist das Pflicht — ohne es liegt das Sitzungstoken
 * bei jedem Aufruf im Klartext auf der Leitung.
 *
 * Der Haken zeigte sich beim ersten lokalen Test eines Production
 * Builds: Anmelden schien zu funktionieren, die Antwort kam mit 200,
 * das Set-Cookie stand im Kopf — und die nächste Seite war wieder das
 * Anmeldeformular. Der Browser hatte das Cookie stillschweigend
 * verworfen, weil `http://localhost` kein TLS ist. Keine Meldung,
 * keine Konsolenwarnung, nur eine Anwendung, in die man sich nicht
 * einloggen kann.
 *
 * Die Ausnahme ist eng und nicht missbrauchbar: sie greift nur, wenn
 * der Host wörtlich localhost oder eine Loopback-Adresse ist. Ein
 * Angreifer kann den Host-Header eines fremden Browsers nicht auf
 * `localhost` setzen — dorthin zeigt der Browser des Opfers auf dessen
 * eigenen Rechner, nicht auf unseren Server. Für jede echte Domain,
 * mit und ohne TLS, bleibt es bei `Secure`.
 */
async function cookieSicher(): Promise<boolean> {
  if (loadRuntimeConfig().nodeEnv !== "production") return false;

  const host = (await headers()).get("host") ?? "";
  // Port abschneiden: "localhost:3100" ist derselbe Fall wie "localhost".
  const name = host.replace(/:\d+$/, "").toLowerCase();
  const lokal = name === "localhost" || name === "127.0.0.1" || name === "[::1]" || name === "::1";
  return !lokal;
}

export async function issueSessionToken(userId: string, userAgent?: string): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");

  await db.insert(schema.sessions).values({
    userId,
    tokenHash: tokenHash(token),
    userAgent: userAgent?.slice(0, 200) ?? null,
    deviceLabel: describeDevice(userAgent),
    expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000),
  });

  return token;
}

export async function createSession(userId: string, userAgent?: string): Promise<void> {
  const cfg = loadRuntimeConfig();
  const token = await issueSessionToken(userId, userAgent);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  const store = await cookies();
  store.set(cfg.auth.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSicher(),
    path: "/",
    expires: expiresAt,
  });
}

function describeDevice(userAgent?: string): string {
  if (!userAgent) return "Unbekanntes Gerät";
  if (/iPhone|iPad/i.test(userAgent)) return "iOS";
  if (/Android/i.test(userAgent)) return "Android";
  if (/Macintosh/i.test(userAgent)) return "Mac";
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Browser";
}

/**
 * Die aktuelle Sitzung. Gibt null zurück, statt zu werfen - Aufrufer
 * entscheiden selbst, ob Anmeldung nötig ist.
 */
/*
 * Einmal je Anfrage, nicht einmal je Aufrufstelle.
 *
 * `currentUser()` steht im Layout UND in fast jeder Seite. Ohne
 * Bündelung sind das zwei Sitzungsabfragen für dieselbe Auskunft — und
 * gegen Supabase je 44 Millisekunden plus Transaktionsaufwand.
 *
 * `cache()` von React gilt genau für einen Renderdurchlauf: zwei
 * Aufrufe innerhalb derselben Anfrage teilen sich das Ergebnis, zwei
 * Anfragen teilen sich nichts. Ein prozessweiter Zwischenspeicher wäre
 * hier ein Sicherheitsproblem — er könnte die Sitzung eines Menschen an
 * den nächsten geben.
 */
export const currentUser = cache(async function currentUser(): Promise<SessionUser | null> {
  const cfg = loadRuntimeConfig();
  const store = await cookies();
  const token = store.get(cfg.auth.cookieName)?.value;
  if (!token) return null;

  const db = await getDb();
  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      displayName: schema.users.displayName,
      role: schema.users.role,
      locale: schema.userSettings.locale,
      sessionId: schema.sessions.id,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .leftJoin(schema.userSettings, eq(schema.userSettings.userId, schema.users.id))
    .where(
      and(
        eq(schema.sessions.tokenHash, tokenHash(token)),
        isNull(schema.sessions.revokedAt),
        gt(schema.sessions.expiresAt, new Date()),
        isNull(schema.users.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Letzten Kontakt fortschreiben, aber ohne den Request zu blockieren.
  // Ein Fehler hier darf die Anmeldung nicht scheitern lassen.
  void Promise.resolve(
    db.update(schema.sessions).set({ lastSeenAt: new Date() }).where(eq(schema.sessions.id, row.sessionId)),
  ).catch(() => undefined);

  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    locale: row.locale ?? "de",
  };
});

/** Für Seiten, die ohne Anmeldung keinen Sinn ergeben. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function destroySession(): Promise<void> {
  const cfg = loadRuntimeConfig();
  const store = await cookies();
  const token = store.get(cfg.auth.cookieName)?.value;
  if (token) {
    const db = await getDb();
    await db
      .update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(eq(schema.sessions.tokenHash, tokenHash(token)));
  }
  store.delete(cfg.auth.cookieName);
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.id, sessionId)),
  );
}

// --- Magic Link ----------------------------------------------------------

export async function createMagicLink(email: string): Promise<string | null> {
  const db = await getDb();
  const users = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.email, email.toLowerCase().trim()), isNull(schema.users.deletedAt)))
    .limit(1);

  // Kein Hinweis darauf, ob die Adresse existiert. Der Aufrufer zeigt in
  // beiden Fällen dieselbe Meldung.
  if (!users[0]) return null;

  const token = randomBytes(32).toString("base64url");
  await db.insert(schema.magicLinks).values({
    email: email.toLowerCase().trim(),
    tokenHash: tokenHash(token),
    purpose: "login",
    expiresAt: new Date(Date.now() + 20 * 60_000),
  });
  return token;
}

export async function consumeMagicLink(token: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.magicLinks)
    .where(
      and(
        eq(schema.magicLinks.tokenHash, tokenHash(token)),
        isNull(schema.magicLinks.consumedAt),
        gt(schema.magicLinks.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const link = rows[0];
  if (!link) return null;

  await db
    .update(schema.magicLinks)
    .set({ consumedAt: new Date() })
    .where(eq(schema.magicLinks.id, link.id));

  const users = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, link.email))
    .limit(1);
  return users[0]?.id ?? null;
}

// --- Registrierung -------------------------------------------------------

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; error: "email_taken" | "email_invalid" | "password_short" };

export async function registerUser(email: string, password: string): Promise<RegisterResult> {
  const normalised = email.toLowerCase().trim();
  if (!isValidEmail(normalised)) return { ok: false, error: "email_invalid" };
  const check = checkPassword(password);
  if (!check.ok) return { ok: false, error: "password_short" };

  const db = await getDb();
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, normalised))
    .limit(1);
  if (existing[0]) return { ok: false, error: "email_taken" };

  const [user] = await db
    .insert(schema.users)
    .values({ email: normalised, passwordHash: hashPassword(password) })
    .returning();

  await db.insert(schema.userSettings).values({ userId: user!.id });
  return { ok: true, userId: user!.id };
}

export async function authenticate(email: string, password: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.users.id, passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(and(eq(schema.users.email, email.toLowerCase().trim()), isNull(schema.users.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    // Gleiche Arbeit leisten wie im Erfolgsfall, damit die Antwortzeit
    // nicht verrät, ob die Adresse existiert.
    verifyPassword(password, hashPassword("dummy-zum-zeitausgleich"));
    return null;
  }
  return verifyPassword(password, row.passwordHash) ? row.id : null;
}

/** Aktive Sitzungen des Menschen, für die Geräteverwaltung. */
/** Mehr als das braucht niemand auf einen Blick. */
const SESSION_ANZEIGE_LIMIT = 20;

export interface SessionListe {
  sessions: {
    id: string;
    deviceLabel: string;
    lastSeenAt: Date;
    isCurrent: boolean;
  }[];
  /** Wie viele es insgesamt sind. Für einen ehrlichen Hinweis. */
  total: number;
}

/**
 * Die aktiven Sitzungen dieser Person.
 *
 * Zwei Dinge, die die erste Fassung falsch gemacht hat, und beide
 * waren in der Entwicklungsdatenbank sichtbar: die Einstellungsseite
 * war **160.000 Pixel hoch** und listete **2.071 Geräte**.
 *
 * **Abgelaufene Sitzungen wurden mitgezählt.** Geprüft wurde nur
 * `revokedAt`. Eine Sitzung, die vor Monaten abgelaufen ist, stand
 * weiter unter „aktive Geräte" — das ist nicht bloss eine zu lange
 * Liste, das ist eine falsche Aussage über die Sicherheit des Kontos.
 *
 * **Es gab keine Obergrenze.** Jede Anmeldung auf jedem Gerät legt eine
 * Zeile an. Ohne Grenze wächst die Seite mit der Nutzungsdauer, und die
 * Person, die dort tatsächlich etwas abmelden will, findet es nicht.
 */
export async function listSessions(userId: string): Promise<SessionListe> {
  const cfg = loadRuntimeConfig();
  const store = await cookies();
  const currentHash = store.get(cfg.auth.cookieName)?.value
    ? tokenHash(store.get(cfg.auth.cookieName)!.value)
    : null;

  const db = await getDb();
  const now = new Date();

  const rows = await withUser(db, userId, (tx) =>
    tx
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.userId, userId),
          isNull(schema.sessions.revokedAt),
          gt(schema.sessions.expiresAt, now),
        ),
      )
      .orderBy(sql`${schema.sessions.lastSeenAt} DESC`),
  );

  const alle = rows.map((r) => ({
    id: r.id,
    deviceLabel: r.deviceLabel ?? "Unbekanntes Gerät",
    lastSeenAt: r.lastSeenAt,
    isCurrent: r.tokenHash === currentHash,
  }));

  // Die aktuelle Sitzung steht immer dabei, auch wenn sie nach
  // Zeitstempel hinten läge. Sonst kann jemand seine eigene Sitzung
  // nicht wiedererkennen.
  const sichtbar = alle.slice(0, SESSION_ANZEIGE_LIMIT);
  const aktuelle = alle.find((s) => s.isCurrent);
  if (aktuelle && !sichtbar.some((s) => s.isCurrent)) {
    sichtbar[sichtbar.length - 1] = aktuelle;
  }

  return { sessions: sichtbar, total: alle.length };
}
