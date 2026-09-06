"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
import type { MatchZustand } from "@paycheck/db/schema";
import { verlangeRolle } from "./zugang";
import { zustandWechseln, type WechselErgebnis } from "./matches";
import { matchesErzeugen } from "./matcher";

/**
 * Was ein Unternehmen an einem Vorschlag tun darf.
 *
 * ── Warum jede Handlung ihre eigene Funktion hat ──────────────
 *
 * Eine einzelne `wechsleZustand(id, ziel)` wäre kürzer und falsch:
 * Dann bestimmte der Browser das Ziel, und „kontakt_offen" liesse sich
 * direkt anfordern. Die Zustandsmaschine würde das abfangen — aber nur,
 * solange sie lückenlos ist.
 *
 * Vier Funktionen mit je einem festen Ziel sind die zweite Schranke:
 * Es gibt keinen Aufruf, mit dem man einen Kontakt öffnen kann.
 */

async function pruefeUndWechsle(
  organizationId: string,
  matchId: string,
  von: MatchZustand,
  nach: MatchZustand,
  begruendung: string,
): Promise<WechselErgebnis> {
  try {
    /* „recruiter" reicht: Wer Bewerbungen bearbeitet, bearbeitet auch
       Vorschläge. Beides ist derselbe Arbeitsvorgang. */
    const { user } = await verlangeRolle(organizationId, "recruiter");
    const db = await getDb();

    const [match] = await db
      .select({ zustand: schema.stellenMatches.zustand })
      .from(schema.stellenMatches)
      .where(
        and(
          eq(schema.stellenMatches.id, matchId),
          eq(schema.stellenMatches.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!match) return { ok: false, fehler: "Diesen Vorschlag gibt es nicht." };
    if (match.zustand !== von) {
      return {
        ok: false,
        fehler: "Der Vorschlag hat sich inzwischen geändert. Lade die Seite neu.",
      };
    }

    const r = await zustandWechseln({
      matchId,
      organizationId,
      von,
      nach,
      akteur: user.id,
      begruendung,
      userId: user.id,
    });
    revalidatePath("/business/matches");
    return r;
  } catch (fehler) {
    return { ok: false, fehler: fehler instanceof Error ? fehler.message : "Das hat nicht geklappt." };
  }
}

/**
 * Die Person fragen, ob sie ihr Profil freigibt.
 *
 * Das ist die einzige Handlung, die von einem Unternehmen ausgeht und
 * bei einem Menschen ankommt. Alles davor ist anonym, alles danach
 * braucht seine Zustimmung.
 */
export async function freigabeAnfragen(organizationId: string, matchId: string) {
  return pruefeUndWechsle(
    organizationId,
    matchId,
    "anonym_erkannt",
    "freigabe_angefragt",
    "Profilfreigabe angefragt",
  );
}

/** Interesse zeigen — erst möglich, wenn das Profil freigegeben ist. */
export async function interesseSenden(organizationId: string, matchId: string) {
  return pruefeUndWechsle(
    organizationId,
    matchId,
    "profil_freigegeben",
    "interesse_gesendet",
    "Interesse gesendet",
  );
}

/**
 * Den Kontakt öffnen.
 *
 * Nur aus `gegenseitiges_interesse` — und dieser Zustand entsteht
 * ausschliesslich, wenn auch die Person Interesse gezeigt hat. Es gibt
 * keinen Aufruf, der ihn von hier aus setzt.
 */
export async function kontaktOeffnen(organizationId: string, matchId: string) {
  return pruefeUndWechsle(
    organizationId,
    matchId,
    "gegenseitiges_interesse",
    "kontakt_offen",
    "Kontakt geöffnet",
  );
}

/** Ablehnen — aus jedem Zustand, in dem der Vorschlag noch lebt. */
export async function vorschlagAblehnen(
  organizationId: string,
  matchId: string,
  grund: string,
) {
  try {
    const { user } = await verlangeRolle(organizationId, "recruiter");
    const db = await getDb();
    const [match] = await db
      .select({ zustand: schema.stellenMatches.zustand })
      .from(schema.stellenMatches)
      .where(
        and(
          eq(schema.stellenMatches.id, matchId),
          eq(schema.stellenMatches.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!match) return { ok: false, fehler: "Diesen Vorschlag gibt es nicht." };

    const r = await zustandWechseln({
      matchId,
      organizationId,
      von: match.zustand,
      nach: "abgelehnt",
      akteur: user.id,
      /* Der Grund landet im Protokoll, nicht bei der Person. Eine
         Absage, die als Nachricht ankommt, wäre eine Kontaktaufnahme —
         und die ist an dieser Stelle nicht freigegeben. */
      begruendung: grund.slice(0, 500),
      userId: user.id,
    });
    revalidatePath("/business/matches");
    return r;
  } catch (fehler) {
    return { ok: false, fehler: fehler instanceof Error ? fehler.message : "Das hat nicht geklappt." };
  }
}

/* ══════════════════════════════════════════════════════════════
   Automatisierung
   ══════════════════════════════════════════════════════════════ */

/**
 * Die Automatisierungsstufe setzen.
 *
 * ── Warum Stufe 3 eine eigene Bedingung hat ───────────────────
 *
 * „Automatisch verbinden" heisst, dass ein Kontakt zustande kommt,
 * ohne dass ein Mensch im Unternehmen ihn ausgelöst hat. Das darf nur
 * greifen, wenn auch die Person diese Kontaktart vorher erlaubt hat —
 * geprüft wird das beim Ausführen, nicht hier.
 *
 * Hier steht die Erlaubnis der einen Seite. Die andere prüft der Lauf.
 */
export async function stufeSetzen(
  organizationId: string,
  postingId: string | null,
  stufe: 1 | 2 | 3,
  minFit: number,
): Promise<WechselErgebnis> {
  try {
    /* Eine Automatisierung, die Nachrichten an Menschen auslöst,
       richtet nicht ein, wer nur Bewerbungen bearbeitet. */
    const { user } = await verlangeRolle(organizationId, "admin");
    const db = await getDb();

    const vorhanden = await db
      .select({ id: schema.matchRegeln.id })
      .from(schema.matchRegeln)
      .where(
        and(
          eq(schema.matchRegeln.organizationId, organizationId),
          postingId
            ? eq(schema.matchRegeln.postingId, postingId)
            : eq(schema.matchRegeln.postingId, schema.matchRegeln.postingId),
        ),
      )
      .limit(1);

    const werte = {
      stufe,
      minFit: Math.min(100, Math.max(0, minFit)),
      geaendertVon: user.id,
      geaendertAm: new Date(),
    };

    if (vorhanden[0]) {
      await db.update(schema.matchRegeln).set(werte).where(eq(schema.matchRegeln.id, vorhanden[0].id));
    } else {
      await db.insert(schema.matchRegeln).values({ organizationId, postingId, ...werte });
    }

    await db.insert(schema.matchProtokoll).values({
      organizationId,
      matchId: null,
      ausgeloestVon: user.id,
      handlung: `Automatisierung auf Stufe ${stufe}`,
      begruendung: `Mindestpassung ${werte.minFit}`,
    });

    revalidatePath("/business/matches");
    return { ok: true };
  } catch (fehler) {
    return { ok: false, fehler: fehler instanceof Error ? fehler.message : "Das hat nicht geklappt." };
  }
}

/**
 * Alle Automatisierungen anhalten.
 *
 * Ein eigener Knopf, nicht „Stufe auf 1 stellen". Wer anhält, will
 * nicht umkonfigurieren, sondern die Einstellungen behalten und sie
 * später unverändert wieder anschalten.
 */
export async function automatisierungPausieren(
  organizationId: string,
  an: boolean,
): Promise<WechselErgebnis> {
  try {
    const { user } = await verlangeRolle(organizationId, "admin");
    const db = await getDb();
    await db
      .update(schema.matchRegeln)
      .set({ pausiertAm: an ? new Date() : null, geaendertVon: user.id, geaendertAm: new Date() })
      .where(eq(schema.matchRegeln.organizationId, organizationId));
    await db.insert(schema.matchProtokoll).values({
      organizationId,
      matchId: null,
      ausgeloestVon: user.id,
      handlung: an ? "Automatisierung pausiert" : "Automatisierung fortgesetzt",
    });
    revalidatePath("/business/matches");
    return { ok: true };
  } catch (fehler) {
    return { ok: false, fehler: fehler instanceof Error ? fehler.message : "Das hat nicht geklappt." };
  }
}


/**
 * Einen Suchlauf über eine Stelle auslösen.
 *
 * ── Warum von Hand und nicht automatisch im Hintergrund ───────
 *
 * Automatisch wäre der nächste Schritt und gehört in den stündlichen
 * Pflegelauf. Bis dahin ist ein Knopf ehrlicher als ein Versprechen:
 * Wer ihn drückt, weiss, wann gerechnet wurde — bei einem
 * Hintergrundlauf, den es noch nicht gibt, wüsste es niemand.
 */
export async function suchlaufStarten(
  organizationId: string,
  postingId: string,
): Promise<{ ok: boolean; fehler?: string; text?: string }> {
  try {
    const { user } = await verlangeRolle(organizationId, "recruiter");
    const r = await matchesErzeugen(organizationId, postingId, user.id);
    revalidatePath("/business/matches");
    return {
      ok: true,
      text:
        r.geprueft === 0
          ? "Niemand hat der Auffindbarkeit zugestimmt — es gab nichts zu prüfen."
          : `${r.geprueft} Profile geprüft, ${r.neu} neue Vorschläge, ${r.aktualisiert} aktualisiert.`,
    };
  } catch (fehler) {
    return { ok: false, fehler: fehler instanceof Error ? fehler.message : "Der Lauf ist gescheitert." };
  }
}
