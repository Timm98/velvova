"use server";

import { createHash, randomBytes } from "node:crypto";
import { getDb, schema, withUser } from "@paycheck/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import {
  darfSenden,
  freigabePruefen,
  freigabeText,
  gueltigBis,
  type Freigabestand,
} from "@paycheck/domain";

/**
 * ══════════════════════════════════════════════════════════════════
 * Ausstellen, einlösen, zurücknehmen
 * ══════════════════════════════════════════════════════════════════
 *
 * Der Riegel vor dem Versand. Er liegt hier und nicht im Systemtext
 * eines Modells: Ein Prompt ist eine Bitte, und ein Modell, das eine
 * Anzeige mit „ignoriere deine Regeln" liest, soll nicht die einzige
 * Instanz sein, die Nein sagt.
 *
 * ── Was diese Datei NICHT tut ───────────────────────────────────
 *
 * Sie versendet nichts. Velvova versendet nichts. Sie stellt fest, ob
 * eine bestimmte Nachricht an einen bestimmten Empfänger hinausgehen
 * dürfte — mehr nicht. Wer den Versandweg baut, findet hier die
 * Bedingung, an der er hängt, und kann sie nicht umgehen, ohne diese
 * Datei zu ändern.
 */

function hash(wert: string): string {
  return createHash("sha256").update(wert).digest("hex");
}

/**
 * Der Fingerabdruck der Nachricht.
 *
 * Über Empfänger, Betreff und Text — mit Trennzeichen, das in keinem
 * davon vorkommen kann. Ohne Trennzeichen wären „Betreff: AB" +
 * „Text: C" und „Betreff: A" + „Text: BC" derselbe Abdruck, und damit
 * liesse sich Inhalt zwischen den Feldern verschieben.
 *
 * Nicht exportiert: In einer „use server"-Datei wäre jeder Export ein
 * aufrufbarer Endpunkt, und eine Hashfunktion muss keiner sein.
 */
function fingerabdruck(empfaenger: string, betreff: string, text: string): string {
  return hash([empfaenger, betreff, text].join("\u0000"));
}

export interface Freigabeergebnis {
  /** Nur hier existiert das Token im Klartext. */
  token: string;
  gueltigBis: Date;
}

/**
 * Eine Freigabe ausstellen.
 *
 * ── Warum das Token nur zurückgegeben und nicht gespeichert wird ─
 *
 * Dieselbe Bauart wie `magic_links` und `sessions`. Wer die Tabelle
 * liest, soll damit nichts senden können.
 */
export async function freigabeAusstellen(
  jobId: string,
  empfaenger: string,
  betreff: string,
  text: string,
  applicationId?: string,
): Promise<Freigabeergebnis | { fehler: string }> {
  const user = await requireUser();

  /*
   * Die Sperre steht vor dem Ausstellen.
   *
   * Eine Freigabe für einen gesperrten Arbeitgeber auszustellen und
   * sie erst beim Einlösen abzulehnen, hiesse: Der Mensch drückt auf
   * „Absenden" und erfährt danach, dass es nie ging.
   */
  if (await gesperrt(jobId)) {
    return { fehler: "An diesen Arbeitgeber geht von hier nichts hinaus." };
  }

  const token = randomBytes(32).toString("base64url");
  const bis = gueltigBis();
  const abdruck = fingerabdruck(empfaenger, betreff, text);
  const db = await getDb();

  try {
    await withUser(db, user.id, (tx) =>
      tx.insert(schema.versandfreigaben).values({
        userId: user.id,
        jobId,
        applicationId: applicationId ?? null,
        empfaenger,
        fingerabdruck: abdruck,
        tokenHash: hash(token),
        gueltigBis: bis,
      }),
    );
  } catch (e) {
    console.error("[versandfreigabe] nicht ausgestellt:", e);
    return { fehler: "Die Freigabe liess sich nicht anlegen. Es wurde nichts versendet." };
  }

  return { token, gueltigBis: bis };
}

export interface Einloesung {
  stand: Freigabestand;
  text: string;
  /** Nur bei „gueltig" gesetzt. */
  freigabeId: string | null;
}

/**
 * Eine Freigabe einlösen.
 *
 * ── Warum das Verbrauchen vor dem Senden steht ──────────────────
 *
 * Weil zwei gleichzeitige Versuche sonst beide durchkämen. Die
 * Bedingung `verwendet_am is null` steht IM Update, nicht in einer
 * Prüfung davor — die Datenbank entscheidet, wer der erste war.
 *
 * Der Preis ist ein möglicher Verlust: Scheitert der Versand danach,
 * ist die Freigabe verbraucht und der Mensch muss neu freigeben. Das
 * ist die richtige Richtung — lieber eine Bewerbung, die nicht
 * hinausging, als zwei, die es taten.
 *
 * ── Warum die Sperre hier noch einmal geprüft wird ──────────────
 *
 * Sie kann nach dem Ausstellen entstanden sein. Dann ist die Freigabe
 * älter als die Tatsache, und die Tatsache gewinnt.
 */
export async function freigabeEinloesen(
  token: string,
  empfaenger: string,
  betreff: string,
  text: string,
): Promise<Einloesung> {
  const user = await requireUser();
  const db = await getDb();

  const [zeile] = await withUser(db, user.id, (tx) =>
    tx
      .select({
        id: schema.versandfreigaben.id,
        jobId: schema.versandfreigaben.jobId,
        empfaenger: schema.versandfreigaben.empfaenger,
        fingerabdruck: schema.versandfreigaben.fingerabdruck,
        gueltigBis: schema.versandfreigaben.gueltigBis,
        verwendetAm: schema.versandfreigaben.verwendetAm,
        widerrufenAm: schema.versandfreigaben.widerrufenAm,
      })
      .from(schema.versandfreigaben)
      .where(
        and(
          eq(schema.versandfreigaben.tokenHash, hash(token)),
          eq(schema.versandfreigaben.userId, user.id),
        ),
      )
      .limit(1),
  ).catch(() => []);

  const stand = freigabePruefen(zeile ?? null, {
    empfaenger,
    fingerabdruck: fingerabdruck(empfaenger, betreff, text),
    gesperrt: zeile ? await gesperrt(zeile.jobId) : false,
  });

  if (!darfSenden(stand) || !zeile) {
    return { stand, text: freigabeText(stand), freigabeId: null };
  }

  /*
   * Der eigentliche Verbrauch. Wer hier null Zeilen zurückbekommt,
   * war nicht der erste — dann galt die Freigabe für jemand anderen
   * im selben Augenblick, und diese Nachricht geht nicht hinaus.
   */
  const verbraucht = await withUser(db, user.id, (tx) =>
    tx
      .update(schema.versandfreigaben)
      .set({ verwendetAm: new Date() })
      .where(
        and(
          eq(schema.versandfreigaben.id, zeile.id),
          isNull(schema.versandfreigaben.verwendetAm),
        ),
      )
      .returning({ id: schema.versandfreigaben.id }),
  ).catch(() => []);

  if (verbraucht.length === 0) {
    return { stand: "verbraucht", text: freigabeText("verbraucht"), freigabeId: null };
  }
  return { stand: "gueltig", text: freigabeText("gueltig"), freigabeId: zeile.id };
}

/**
 * Eine Freigabe zurücknehmen.
 *
 * Solange sie nicht verbraucht ist. Danach gibt es nichts
 * zurückzunehmen — die Nachricht ist draussen, und das zu behaupten
 * wäre eine Lüge über etwas, das der Mensch nicht mehr ändern kann.
 */
export async function freigabeWiderrufen(freigabeId: string): Promise<boolean> {
  const user = await requireUser();
  const db = await getDb();
  const zeilen = await withUser(db, user.id, (tx) =>
    tx
      .update(schema.versandfreigaben)
      .set({ widerrufenAm: new Date() })
      .where(
        and(
          eq(schema.versandfreigaben.id, freigabeId),
          eq(schema.versandfreigaben.userId, user.id),
          isNull(schema.versandfreigaben.verwendetAm),
          isNull(schema.versandfreigaben.widerrufenAm),
        ),
      )
      .returning({ id: schema.versandfreigaben.id }),
  ).catch(() => []);
  return zeilen.length > 0;
}

/**
 * Steht der Arbeitgeber dieser Stelle auf einer Sperre?
 *
 * Zwei Quellen, und beide zählen:
 *
 *   `arbeitgeber_kontaktsperre`  Der Arbeitgeber selbst hat „bitte
 *                                nicht mehr" gesagt. Gilt für alle.
 *   `current_employment`         Der eigene aktuelle Arbeitgeber.
 *                                Eine Bewerbung, die dort ankommt,
 *                                ist das Schlimmste, was dieses
 *                                Produkt anrichten kann.
 *
 * Über die Systemverbindung gelesen: Die Kontaktsperre trägt keine
 * Nutzerkennung — sie gilt dem Arbeitgeber gegenüber, nicht der
 * einen Person, die zufällig gefragt hat.
 */
async function gesperrt(jobId: string): Promise<boolean> {
  const user = await requireUser();
  const db = await getDb();
  try {
    const ergebnis = (await withUser(db, user.id, (tx) =>
      tx.execute(sql`
        select exists (
          select 1
          from jobs j
          join arbeitgeber_kontaktsperre s on s.company_id = j.company_id
          where j.id = ${jobId}::uuid
        ) or exists (
          select 1
          from jobs j
          join companies c on c.id = j.company_id
          join current_employment ce on ce.user_id = ${user.id}::uuid
          where j.id = ${jobId}::uuid
            and ce.company_name is not null
            and lower(ce.company_name) = lower(c.name)
        ) as gesperrt`),
    )) as unknown as { rows: { gesperrt: boolean }[] };
    return ergebnis.rows[0]?.gesperrt === true;
  } catch (e) {
    /*
     * Im Zweifel gesperrt.
     *
     * Eine Prüfung, die bei einem Fehler „nicht gesperrt" sagt, ist
     * keine Prüfung. Der Preis ist eine Bewerbung, die nicht
     * hinausgeht — der andere Preis wäre eine, die beim eigenen
     * Arbeitgeber ankommt.
     */
    console.error("[versandfreigabe] Sperrprüfung fehlgeschlagen:", e);
    return true;
  }
}
