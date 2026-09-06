import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import {
  BERECHTIGUNG_AB,
  GRENZEN,
  PLAN_RANG,
  type Berechtigung,
  type Grenzen,
  type PlanKey,
} from "./plaene.ts";

/**
 * Wer darf was.
 *
 * Eine Stelle, an der die Frage beantwortet wird — nicht eine pro
 * Seite. Verstreute Prüfungen waren der Grund, warum vorher halbe
 * Seiten gesperrt waren, ohne dass jemand das so entschieden hätte.
 *
 * **Ausschliesslich serverseitig.** Diese Datei läuft nie im Browser:
 * sie liest die Datenbank. Was die Oberfläche bekommt, ist das
 * Ergebnis — eine Liste von Ja/Nein und Zahlen. Eine Berechtigung, die
 * im Client entschieden wird, ist keine Berechtigung, sondern eine
 * Anzeige.
 *
 * Die Voreinstellung ist grosszügig: ohne Abo gilt `free`, und `free`
 * ist ein vollständiges kleines Produkt. Fällt die Datenbank aus, gilt
 * ebenfalls `free` — niemand verliert Zugang, weil eine Abfrage
 * scheitert. Der umgekehrte Fehler wäre schlimmer: jemand sähe eine
 * Sperre, für die er bezahlt hat.
 */

export type AboStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete";

export interface Zugang {
  plan: PlanKey;
  status: AboStatus;
  /** Seit wann der laufende Zeitraum läuft. */
  zeitraumBeginn: Date | null;
  /** Bis wann bezahlt ist — zugleich die nächste Abbuchung. */
  zeitraumEnde: Date | null;
  /** Gekündigt, läuft aber noch bis zum Ende des bezahlten Zeitraums. */
  gekuendigtZum: Date | null;
  /** Ende einer Testphase, falls eine läuft. */
  testphaseEndet: Date | null;
  interval: "month" | "year" | null;
  /** Die Grenzen dieses Plans. */
  grenzen: Grenzen;
  /** Die einzige Frage, die der Rest der Anwendung stellen soll. */
  darf: (was: Berechtigung) => boolean;
  /** Alle Berechtigungen auf einmal — für die Übergabe an den Client. */
  berechtigungen: Record<Berechtigung, boolean>;
}

/**
 * Zählt ein Abo als bezahlt?
 *
 * `active` und `trialing` ja — solange der Zeitraum läuft. Ein
 * gekündigtes Abo bleibt bis zum Ende des bezahlten Zeitraums gültig:
 * wer bis zum 30. bezahlt hat, wird nicht am 3. ausgesperrt.
 *
 * `past_due` bewusst auch: eine fehlgeschlagene Abbuchung ist ein
 * Vorgang zwischen uns und der Bank, kein Grund, jemandem mitten in
 * einer Bewerbung die Unterlagen wegzunehmen. Der Zugang endet mit dem
 * Zeitraum, nicht mit der ersten Rücklastschrift.
 */
function giltNoch(status: AboStatus, ende: Date | null): boolean {
  if (status === "canceled" || status === "incomplete") return false;
  if (!ende) return status === "active" || status === "trialing";
  return ende.getTime() > Date.now();
}

const OHNE_ABO = {
  plan: "free" as PlanKey,
  status: "active" as AboStatus,
  zeitraumBeginn: null as Date | null,
  zeitraumEnde: null as Date | null,
  gekuendigtZum: null as Date | null,
  testphaseEndet: null as Date | null,
  interval: null as "month" | "year" | null,
};

export const zugangFür = cache(async function zugangFür(userId: string): Promise<Zugang> {
  let roh = { ...OHNE_ABO };

  try {
    const db = await getDb();
    const [abo] = await withUser(db, userId, (tx) =>
      tx
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.userId, userId))
        .limit(1),
    );

    if (abo) {
      const status = abo.status as AboStatus;
      const ende = abo.currentPeriodEnd;
      roh = {
        plan: giltNoch(status, ende) ? abo.plan : "free",
        status,
        zeitraumBeginn: abo.currentPeriodStart,
        zeitraumEnde: ende,
        gekuendigtZum: abo.cancelAtPeriodEnd ? ende : null,
        testphaseEndet: abo.trialEnd,
        interval: abo.interval,
      };
    }
  } catch {
    // Siehe oben: im Zweifel free, nicht gesperrt.
  }

  const rang = PLAN_RANG[roh.plan];
  const berechtigungen = Object.fromEntries(
    (Object.keys(BERECHTIGUNG_AB) as Berechtigung[]).map((b) => [
      b,
      rang >= PLAN_RANG[BERECHTIGUNG_AB[b]],
    ]),
  ) as Record<Berechtigung, boolean>;

  return {
    ...roh,
    grenzen: GRENZEN[roh.plan],
    berechtigungen,
    darf: (was) => berechtigungen[was],
  };
});

/**
 * Dasselbe, aber ohne Funktionen — zum Durchreichen an Client-Bauteile.
 *
 * `darf` ist eine Funktion und lässt sich nicht über die Grenze
 * zwischen Server und Client schicken. Statt an jeder Aufrufstelle
 * einzeln Felder abzuschreiben, gibt es dafür diese eine Umformung.
 */
export interface ZugangFuerClient {
  plan: PlanKey;
  berechtigungen: Record<Berechtigung, boolean>;
  grenzen: Grenzen;
}

export function fuerClient(z: Zugang): ZugangFuerClient {
  return { plan: z.plan, berechtigungen: z.berechtigungen, grenzen: z.grenzen };
}

/**
 * Die Prüfung für Server-Aktionen und Routen.
 *
 * Wirft nicht — gibt zurück, was fehlt. Ein Wurf wäre hier falsch: das
 * Fehlen einer Berechtigung ist kein Fehler, sondern ein regulärer
 * Zustand, auf den die Oberfläche mit einem Angebot antwortet statt mit
 * einer Fehlerseite.
 */
export async function pruefe(
  userId: string,
  was: Berechtigung,
): Promise<{ erlaubt: boolean; plan: PlanKey; noetig: PlanKey }> {
  const z = await zugangFür(userId);
  return { erlaubt: z.darf(was), plan: z.plan, noetig: BERECHTIGUNG_AB[was] };
}
