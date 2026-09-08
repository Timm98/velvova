import type { RawListing } from "../../adapter.ts";
import { envWert } from "../../net.ts";

/**
 * SmartRecruiters Job-Board-Feed — vorbereitet, abgeschaltet.
 *
 * ══════════════════════════════════════════════════════════════
 * Was diese API kann, was die öffentliche nicht kann
 * ══════════════════════════════════════════════════════════════
 *
 * Sie kennt `toUnpost`: den Zustand einer Ausschreibung, die
 * abgelaufen ist oder vom Kunden zur Entfernung angefordert wurde.
 * Das ist ein AUSDRÜCKLICHES Schliesssignal — Stufe 1 der
 * Verfügbarkeitslogik.
 *
 * Der Unterschied zur öffentlichen `/v1/companies/{id}/postings` ist
 * gross und leicht zu unterschätzen:
 *
 *   öffentlich   zeigt, was JETZT aktiv ist
 *                → Verschwinden ist ein Rückschluss, und der braucht
 *                  einen Bestätigungslauf
 *
 *   Partnerfeed  sagt, dass eine Stelle beendet IST
 *                → kein Rückschluss, kein Wartelauf, kein Zweifel
 *
 * Bei einem Arbeitgeber, der eine Stelle morgens schliesst, sieht der
 * Partnerfeed es sofort; die öffentliche Momentaufnahme erst nach
 * zwei vollständigen Läufen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie trotzdem aus ist
 * ══════════════════════════════════════════════════════════════
 *
 * Sie braucht `X-SmartToken`, und den gibt es nur mit
 * Partnervereinbarung. Ohne Token antwortet sie mit 401 — es gibt
 * also keinen Weg, sie versehentlich zu benutzen.
 *
 * Der Schalter steht trotzdem da, und zwar aus demselben Grund wie
 * bei Nomado24: Ein fehlender Zugang ist keine Entscheidung. Wer
 * eines Tages einen Token einträgt, soll damit nicht nebenbei eine
 * Quelle scharfstellen, sondern erst dann, wenn er es auch will.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier bewusst NICHT steht
 * ══════════════════════════════════════════════════════════════
 *
 * Kein geratenes Antwortmodell. Ich habe diese API nie gesehen — sie
 * antwortet ohne Token nicht, und ein Modell aus der Dokumentation
 * abzuschreiben und als geprüft auszugeben wäre genau der Fehler, den
 * die Nomado24-Integration vermeiden sollte.
 *
 * Was hier steht, ist der Rahmen: der Endpunkt, die Kopfzeile, der
 * Schalter und die Stelle, an der das Modell einzieht. Der Mapper
 * kommt, wenn ein Token da ist und eine echte Antwort dazu.
 */

const FEED_BASIS = "https://api.smartrecruiters.com/v1/postings";

export interface PartnerfeedStand {
  /** Ob ein Token hinterlegt UND der Schalter an ist. */
  verfuegbar: boolean;
  /** Warum nicht — für die Quellenübersicht. */
  grund: string | null;
  endpunkt: string;
}

/**
 * Ob der Partnerfeed benutzt werden darf.
 *
 * Zwei Bedingungen, und beide müssen stimmen. Der Token allein
 * genügt nicht: Ein Zugang, der da ist, ist noch keine Freigabe.
 */
export function partnerfeedStand(): PartnerfeedStand {
  const token = envWert("SMARTRECRUITERS_PARTNER_TOKEN");
  const an = envWert("ENABLE_SMARTRECRUITERS_PARTNER_FEED") === "true";

  if (!an) {
    return {
      verfuegbar: false,
      grund: "ENABLE_SMARTRECRUITERS_PARTNER_FEED steht nicht auf true.",
      endpunkt: FEED_BASIS,
    };
  }
  if (!token) {
    return {
      verfuegbar: false,
      grund: "SMARTRECRUITERS_PARTNER_TOKEN fehlt. Der Feed antwortet ohne ihn mit 401.",
      endpunkt: FEED_BASIS,
    };
  }
  return { verfuegbar: true, grund: null, endpunkt: FEED_BASIS };
}

/**
 * Die Kopfzeilen für den Feed.
 *
 * `X-SmartToken`, nicht `Authorization: Bearer` — SmartRecruiters
 * benutzt einen eigenen Kopf, und wer den Bearer-Weg nimmt, bekommt
 * 401 und sucht den Fehler beim Token.
 *
 * Exportiert und einzeln geprüft, damit die Schreibweise nicht erst
 * dann auffällt, wenn ein Token da ist.
 */
export function partnerfeedKopfzeilen(token: string): Record<string, string> {
  return { "X-SmartToken": token, Accept: "application/json" };
}

/**
 * Der Platzhalter für den Abruf.
 *
 * Er wirft, statt etwas zurückzugeben — und die Meldung sagt, was
 * fehlt. Eine Funktion, die bei fehlendem Zugang eine leere Liste
 * liefert, sähe aus wie eine Quelle ohne Stellen.
 */
export async function partnerfeedAbrufen(): Promise<RawListing[]> {
  const stand = partnerfeedStand();
  throw new Error(
    stand.verfuegbar
      ? "Der SmartRecruiters-Partnerfeed ist freigegeben, aber noch nicht gebaut: Es fehlt eine " +
        "echte Antwort, an der sich das Modell prüfen lässt. Bis dahin wird nichts abgerufen."
      : `Der SmartRecruiters-Partnerfeed ist nicht verfügbar. ${stand.grund}`,
  );
}
