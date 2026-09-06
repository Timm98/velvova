import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb, schema, withSystem } from "@paycheck/db";
import { abmeldeTokenHash } from "@paycheck/jobs";

/**
 * Abmeldung ohne Anmeldung.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein GET nichts speichert
 * ══════════════════════════════════════════════════════════════
 *
 * Weil Postfächer Links anklicken. Virenscanner, Vorschauzeilen,
 * Sicherheitsdienste in Unternehmen — sie holen jede Adresse in einer
 * Mail ab, bevor ein Mensch sie sieht.
 *
 * Ein GET, das abmeldet, meldet deshalb Menschen ab, die nie geklickt
 * haben. Das ist kein theoretisches Risiko: Es ist der häufigste Grund
 * für „ich bekomme plötzlich nichts mehr".
 *
 * Also: GET zeigt eine Seite mit einem Knopf. POST meldet ab.
 *
 * ══════════════════════════════════════════════════════════════
 * Und warum es trotzdem einen Ein-Klick-Weg gibt
 * ══════════════════════════════════════════════════════════════
 *
 * RFC 8058: Postfachanbieter zeigen einen eigenen Abmeldeknopf, wenn
 * die Mail `List-Unsubscribe` und `List-Unsubscribe-Post` trägt. Der
 * Anbieter schickt dann selbst ein POST — kein Scanner, sondern eine
 * bewusste Handlung der Person in ihrer Oberfläche.
 *
 * Das ist derselbe Endpunkt, dieselbe Prüfung, und es umgeht die Regel
 * oben nicht: Es ist ein POST.
 */

export type Abmeldebefund =
  | { ok: true; adresse: string | null }
  | { ok: false; grund: "unbekannt" | "abgelaufen" };

/**
 * Prüfen, ob ein Token gilt — ohne etwas zu ändern.
 *
 * Für die Bestätigungsseite. Sie soll sagen können „dieser Link gilt
 * nicht mehr", statt einen Knopf anzubieten, der scheitert.
 */
export async function tokenPruefen(token: string): Promise<Abmeldebefund> {
  if (token.length < 16 || token.length > 128) return { ok: false, grund: "unbekannt" };
  const db = await getDb();
  return withSystem(db, async (tx) => {
    const zeilen = (await tx.execute(sql`
      select t.user_id, t.gueltig_bis, e.email_adresse
      from abmelde_token t
      left join benachrichtigung_einstellungen e on e.user_id = t.user_id
      where t.token_hash = ${abmeldeTokenHash(token)} limit 1`)) as unknown as {
      rows: { user_id: string; gueltig_bis: Date | null; email_adresse: string | null }[];
    };
    const zeile = zeilen.rows[0];
    if (!zeile) return { ok: false, grund: "unbekannt" as const };
    if (zeile.gueltig_bis !== null && zeile.gueltig_bis.getTime() < Date.now())
      return { ok: false, grund: "abgelaufen" as const };
    /*
     * Die Adresse wird verkürzt gezeigt, nicht vollständig.
     *
     * Wer den Link in fremde Hände gibt — weitergeleitete Mail,
     * geteilter Bildschirm —, soll damit keine Adresse preisgeben.
     */
    return { ok: true as const, adresse: verkuerzt(zeile.email_adresse) };
  });
}

function verkuerzt(adresse: string | null): string | null {
  if (!adresse) return null;
  const [name, rest] = adresse.split("@");
  if (!rest || !name) return null;
  const sichtbar = name.slice(0, 2);
  return `${sichtbar}${"•".repeat(Math.max(1, name.length - 2))}@${rest}`;
}

/**
 * Abmelden. Nur über POST erreichbar.
 *
 * Das Token erlaubt genau diese eine Sache: E-Mails abstellen. Es
 * öffnet keine Profilansicht, meldet niemanden an und beendet keine
 * Suche — wer sich abmeldet, will keine Mails, nicht keine Stellen.
 */
export async function abmelden(token: string): Promise<Abmeldebefund> {
  const geprueft = await tokenPruefen(token);
  if (!geprueft.ok) return geprueft;

  const db = await getDb();
  return withSystem(db, async (tx) => {
    const zeilen = (await tx.execute(sql`
      select user_id from abmelde_token where token_hash = ${abmeldeTokenHash(token)} limit 1`)) as unknown as {
      rows: { user_id: string }[];
    };
    const userId = zeilen.rows[0]?.user_id;
    if (!userId) return { ok: false, grund: "unbekannt" as const };

    const einstellung = (await tx.execute(sql`
      select email_adresse from benachrichtigung_einstellungen where user_id = ${userId}::uuid limit 1`)) as unknown as {
      rows: { email_adresse: string | null }[];
    };

    await tx
      .update(schema.benachrichtigungEinstellungen)
      .set({ emailAktiv: false, aktualisiertAm: new Date() })
      .where(eq(schema.benachrichtigungEinstellungen.userId, userId));

    /*
     * Die Adresse kommt zusätzlich auf die Sperrliste.
     *
     * Nicht doppelt gemoppelt: Die Einstellung gilt für das Konto, die
     * Sperre für die Adresse. Wer ein zweites Konto mit derselben
     * Adresse anlegt, bekommt trotzdem nichts — und genau das war
     * gemeint.
     */
    const adresse = einstellung.rows[0]?.email_adresse;
    if (adresse) {
      await tx
        .insert(schema.unterdrueckungen)
        .values({ email: adresse, grund: "abgemeldet", quelle: "abmeldelink" })
        .onConflictDoNothing();
    }

    /* Verbraucht — aber nicht gelöscht: Ein zweiter Klick soll
       „schon abgemeldet" sagen und nicht „Link ungültig". */
    await tx.execute(sql`
      update abmelde_token set verwendet_am = now()
      where token_hash = ${abmeldeTokenHash(token)} and verwendet_am is null`);

    return { ok: true as const, adresse: verkuerzt(adresse ?? null) };
  });
}

/*
 * Re-Export: Die Kopfzeilen stehen in `@paycheck/jobs`.
 *
 * Sie mussten dorthin, weil der Versand auch aus einem Skript heraus
 * laufen können muss — und `server-only`, das diese Datei trägt,
 * lässt sich ausserhalb des Next-Builds nicht auflösen.
 */
export { abmeldeKopfzeilen } from "@paycheck/jobs";
