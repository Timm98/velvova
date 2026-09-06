import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { meineOrganisationen } from "@/lib/arbeitgeber/zugang";

export const dynamic = "force-dynamic";

/**
 * Der Einstieg für Unternehmen — eine Weiche, keine Seite.
 *
 * ── Warum ein Route Handler und keine Seite ───────────────────
 *
 * Als Seite lag sie unter `app/business/`, und dieser Rahmen verlangt
 * eine Anmeldung: `layout.tsx` ruft `requireUser()`. Der Rahmen läuft
 * VOR der Seite — also landete jeder, der auf „Unternehmen
 * registrieren" klickte, auf `/login` statt bei der Registrierung.
 *
 * Genau die Sorte Fehler, die man nur im Browser sieht: Der Code der
 * Seite war richtig, er kam nur nie an die Reihe.
 *
 * Ein Route Handler hat keinen Rahmen. Er beantwortet die Anfrage
 * selbst und leitet weiter, ohne die Anmeldepflicht der Umgebung zu
 * erben.
 *
 * ── Wohin ─────────────────────────────────────────────────────
 *
 *   nicht angemeldet              → Registrierung, Absicht „Unternehmen"
 *   angemeldet, ohne Organisation → Einrichtung
 *   angemeldet, mit Organisation  → Arbeitgeberbereich
 *
 * ── Warum kein zweites Registrierungsformular ─────────────────
 *
 * Ein getrenntes Arbeitgeber-Login hiesse zweite Passwortstrecke,
 * zweiter Sitzungsweg, zweite Fehlerquelle. Und es wäre falsch herum
 * gedacht: Dieselbe Person kann morgens Stellen ausschreiben und abends
 * selbst suchen. Deshalb sind Konto und Organisation getrennte Dinge.
 */
export async function GET(request: NextRequest) {
  const ziel = (pfad: string) => NextResponse.redirect(new URL(pfad, request.url));

  const user = await currentUser();
  if (!user) {
    return ziel("/register?absicht=unternehmen&weiter=%2Fbusiness%2Feinrichten");
  }

  const orgs = await meineOrganisationen(user.id);
  return ziel(orgs.length > 0 ? "/business" : "/business/einrichten");
}
