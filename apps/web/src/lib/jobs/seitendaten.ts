import "server-only";

import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { ortNachschlagen } from "@paycheck/jobs";
import { gateAusTx } from "@/lib/gate";
import { profilkontextAusTx, type UserProfileContext } from "@/lib/matching";
import { gehaltsangabenAusTx } from "@/lib/payroll/lesen";
import { lebenshaltungAusTx, type Lebenshaltung } from "@/lib/lebenswert/lesen";
import { filterAusTx } from "@/lib/jobs/listenfilter";
import { abgelegteStellenAusTx } from "@/lib/nina/rueckmeldung";
import { ladeSitzungsbedingungen } from "@/lib/nina/sitzungsbedingungen";
import type { Gehaltsangaben } from "@/lib/payroll/angaben";
import type { MinimumProfileGate } from "@paycheck/domain";

/**
 * Alles, was die Stellenseite über die Person wissen muss — an einer
 * Stelle, und im Voraus abrufbar.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das eine eigene Datei ist
 * ══════════════════════════════════════════════════════════════
 *
 * Diese Daten standen in `app/jobs/page.tsx` und wurden dort bei jedem
 * Aufruf geholt — gemessen 366 Millisekunden, fast ausschliesslich
 * Netzrunden gegen Supabase. Man sah sie als Wartezeit, obwohl sich
 * zwischen zwei Aufrufen selten etwas ändert.
 *
 * Hier stehen sie als eigene Funktion, und damit lassen sie sich
 * VORHER holen: `POST /api/jobs/vorwaermen` ruft sie auf, während
 * jemand noch mit Monday spricht. Kommt der Wechsel, sind sie da.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Frist — und warum sie kurz ist
 * ══════════════════════════════════════════════════════════════
 *
 * Zwanzig Sekunden. Lang genug, dass das Vorwärmen etwas bringt; kurz
 * genug, dass eine Änderung an den eigenen Angaben nicht spürbar alt
 * wird. Wer im Konto etwas ändert und danach zur Stellenseite geht,
 * ist unterwegs länger als das.
 *
 * Der Zwischenspeicher liegt je Person getrennt und wird ausdrücklich
 * mit ihrer Kennung geschlüsselt. Er hält nichts, was jemand anderes
 * lesen könnte — und die Zeilensicherheit greift ohnehin unabhängig
 * davon, weil jede Abfrage darunter in `withUser` läuft.
 */
const FRIST_MS = 20_000;

/** Wie viele Personen gleichzeitig vorgehalten werden. */
const HOECHSTENS = 200;

export interface Stellenseitendaten {
  gate: MinimumProfileGate & { hasAnySession: boolean };
  ctx: UserProfileContext;
  saved: { jobId: string }[];
  gemerkteFilter: Record<string, string>;
  abgelegt: Set<string>;
  gehaltsangaben: Gehaltsangaben;
  lebenshaltung: Lebenshaltung;
  wohnpunkt: { latitude: number; longitude: number } | null;
  /** Der eingetragene Wohnort als Text — für die Anzeige, nicht fürs Rechnen. */
  wohnort: string | null;
}

const speicher = new Map<string, { at: number; daten: Stellenseitendaten }>();
const laufend = new Map<string, Promise<Stellenseitendaten>>();

/**
 * Die Daten holen — aus dem Zwischenspeicher, wenn sie frisch sind.
 *
 * `laufend` verhindert den doppelten Lauf: Wenn das Vorwärmen noch
 * unterwegs ist und die Person in dem Moment wechselt, wartet der
 * Seitenaufbau auf denselben Vorgang, statt einen zweiten zu starten.
 * Ohne das wäre das Vorwärmen im schlechtesten Fall doppelte Arbeit
 * statt gesparter.
 */
export async function stellenseitendaten(userId: string): Promise<Stellenseitendaten> {
  const gemerkt = speicher.get(userId);
  if (gemerkt && Date.now() - gemerkt.at < FRIST_MS) return gemerkt.daten;

  const schon = laufend.get(userId);
  if (schon) return schon;

  const vorgang = holen(userId)
    .then((daten) => {
      speicher.set(userId, { at: Date.now(), daten });
      aufraeumen();
      return daten;
    })
    .finally(() => {
      laufend.delete(userId);
    });

  laufend.set(userId, vorgang);
  return vorgang;
}

/**
 * Dasselbe, aber ohne Ergebnis und ohne Fehler nach aussen.
 *
 * Das Vorwärmen ist ein Angebot, keine Zusage: Schlägt es fehl, holt
 * der Seitenaufbau die Daten wie bisher selbst. Ein Fehler hier darf
 * niemandem das Gespräch stören.
 */
export async function stellenseiteVorwaermen(userId: string): Promise<void> {
  await stellenseitendaten(userId).catch(() => undefined);
}

/** Nach einer Änderung an den eigenen Angaben: den Stand verwerfen. */
export function stellenseiteVergessen(userId: string): void {
  speicher.delete(userId);
}

async function holen(userId: string): Promise<Stellenseitendaten> {
  const db = await getDb();

  /*
   * Die Sitzungsbedingungen kommen aus einem Keks, nicht aus der
   * Datenbank. Sie VOR den Transaktionen zu lesen hält keine
   * Verbindung offen, während auf etwas gewartet wird, das längst da
   * ist.
   */
  const sitzung = await ladeSitzungsbedingungen();

  /*
   * Vier Transaktionen nebeneinander, nicht eine mit allem darin.
   *
   * Eine Transaktion läuft auf EINER Verbindung, und eine Verbindung
   * arbeitet ihre Abfragen nacheinander ab — `Promise.all` darin
   * täuscht Gleichzeitigkeit nur vor. Gemessen an dieser Seite:
   *
   *     sieben Transaktionen, nebeneinander    422 ms
   *     eine Transaktion, alles darin          575 ms
   *     vier Transaktionen, nebeneinander      366 ms
   *
   * Die kleinen Lesevorgänge teilen sich zwei Gruppen, weil ihre
   * Verwaltung (BEGIN, Rolle, COMMIT) mehr kostet als ihre Abfragen.
   * Riegel und Profil bekommen eigene, weil sie selbst mehrere
   * Abfragen haben und sonst hinter den kleinen anstehen müssten.
   */
  const kleineWerte = withUser(db, userId, (tx) =>
    Promise.all([
      tx
        .select({ jobId: schema.savedJobs.jobId })
        .from(schema.savedJobs)
        .where(eq(schema.savedJobs.userId, userId)),
      tx
        .select({ baseLocation: schema.userSettings.baseLocation })
        .from(schema.userSettings)
        .where(eq(schema.userSettings.userId, userId))
        .limit(1),
      filterAusTx(tx, userId).catch(() => ({}) as Record<string, string>),
    ]),
  );

  /*
   * Der Wohnort wird nachgeschlagen, sobald er bekannt ist — nicht
   * danach. Vorher lief das als eigene Runde hinter der Sammelrunde,
   * obwohl es nur die eine Zeile aus `user_settings` braucht.
   */
  const wohnpunktUnterwegs = kleineWerte.then(([, zeile]) =>
    zeile[0]?.baseLocation
      ? ortNachschlagen(db, zeile[0].baseLocation)
          .then((a) =>
            /*
             * Genau oder auf Stadtebene — beides genügt. `ambiguous`
             * ausdrücklich nicht: Ein falscher Mittelpunkt verschiebt
             * nicht eine Anzeige, sondern die ganze Suche.
             */
            (a.status === "resolved_exact" || a.status === "resolved_city") &&
            a.latitude !== null &&
            a.longitude !== null
              ? { latitude: a.latitude, longitude: a.longitude }
              : null,
          )
          .catch(() => null)
      : null,
  );

  const [gate, ctx, [saved, wohnzeile, gemerkteFilter], [abgelegt, gehaltsangaben, lebenshaltung], wohnpunkt] =
    await Promise.all([
      withUser(db, userId, (tx) => gateAusTx(tx, userId)),
      withUser(db, userId, (tx) => profilkontextAusTx(tx, userId, sitzung)),
      kleineWerte,
      withUser(db, userId, (tx) =>
        Promise.all([
          /* Mitgelesen statt von `listJobsForUser` selbst geholt: dort
             wäre es eine eigene Transaktion, also vier Netzrunden.
             Gemessen war genau diese Abfrage 179 von 181 Millisekunden
             jener Funktion. */
          abgelegteStellenAusTx(tx, userId),
          gehaltsangabenAusTx(tx, userId),
          lebenshaltungAusTx(tx, userId),
        ]),
      ),
      wohnpunktUnterwegs,
    ]);

  return {
    gate,
    ctx,
    saved,
    gemerkteFilter,
    abgelegt,
    gehaltsangaben,
    lebenshaltung,
    wohnpunkt,
    wohnort: wohnzeile[0]?.baseLocation ?? null,
  };
}

/**
 * Der älteste fliegt, wenn es zu viele werden.
 *
 * Ein Zwischenspeicher mit Frist, aber ohne Aufräumen, ist ein Leck:
 * Ein Eintrag gilt nach zwanzig Sekunden als alt und wird neu geholt —
 * verschwinden würde er nie.
 */
function aufraeumen(): void {
  if (speicher.size <= HOECHSTENS) return;
  const nachAlter = [...speicher.entries()].sort((a, b) => a[1].at - b[1].at);
  for (const [id] of nachAlter.slice(0, speicher.size - HOECHSTENS)) speicher.delete(id);
}
