"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema, withSystem, withUser } from "@paycheck/db";
import { abmeldeTokenErzeugen, abmeldeTokenHash } from "@paycheck/jobs";
import { loadRuntimeConfig } from "@paycheck/config";
import { requireUser } from "@/lib/auth";
import { mailBereit, versendeMail } from "@/lib/mail/versand";

/**
 * E-Mail für Zusammenfassungen — anmelden und bestätigen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum eine verifizierte Anmeldeadresse nicht reicht
 * ══════════════════════════════════════════════════════════════
 *
 * Wer sich mit einer Adresse angemeldet hat, hat belegt, dass sie ihm
 * gehört. Er hat damit nicht gesagt, dass er morgens Jobmails will.
 *
 * Das sind zwei Aussagen, und sie zu verwechseln ist die bequemste
 * Art, einen Verteiler zu füllen — und die, die sich hinterher nicht
 * belegen lässt. Deshalb ein eigener Nachweis: eine Adresse, ein
 * Zeitpunkt, ein Klick der Person selbst.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum auch hier das GET nichts bestätigt
 * ══════════════════════════════════════════════════════════════
 *
 * Beim Abmelden ist der Scanner das Problem, weil er Menschen
 * abmeldet. Beim Bestätigen ist er das grössere Problem: Er würde eine
 * Adresse bestätigen, deren Besitzer nie geklickt hat — und damit
 * genau das aushebeln, wofür der Double-Opt-in da ist.
 *
 * Also dieselbe Regel: Die Seite zeigt einen Knopf, das POST
 * bestätigt.
 */

export type Anmeldebefund =
  | { ok: true; entwurf: boolean }
  | { ok: false; grund: "adresse_ungueltig" | "gesperrt" | "kein_versand" };

const ADRESSE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Eine Adresse eintragen und die Bestätigung anstossen.
 *
 * Setzt `email_aktiv` NICHT. Aktiv wird sie erst mit dem Klick — bis
 * dahin steht eine Adresse da, an die nichts geht.
 */
export async function emailAnmelden(roh: string): Promise<Anmeldebefund> {
  const user = await requireUser();
  const adresse = roh.trim().toLowerCase().slice(0, 320);
  if (!ADRESSE.test(adresse)) return { ok: false, grund: "adresse_ungueltig" };

  const db = await getDb();

  /*
   * Eine gesperrte Adresse wird nicht wieder angemeldet.
   *
   * Wer sich beschwert hat oder deren Postfach hart abgewiesen hat,
   * bekommt nichts — auch nicht die Bestätigungsmail. Die wäre schon
   * eine Mail zu viel.
   */
  const gesperrt = await withSystem(db, async (tx) => {
    const r = (await tx.execute(
      sql`select 1 from unterdrueckungen where lower(email) = ${adresse} limit 1`,
    )) as unknown as { rows: unknown[] };
    return r.rows.length > 0;
  });
  if (gesperrt) return { ok: false, grund: "gesperrt" };

  const stand = mailBereit();
  if (!stand.bereit) {
    /*
     * Ohne Versandweg wird nichts eingetragen.
     *
     * Eine Adresse zu speichern und „Bestätigungsmail unterwegs" zu
     * melden, wenn keine unterwegs ist, wäre die Erfolgsmeldung ohne
     * Wirkung, die dieses Produkt nicht haben soll.
     */
    return { ok: false, grund: "kein_versand" };
  }

  const { token, hash } = abmeldeTokenErzeugen();
  const jetzt = new Date();

  await withUser(db, user.id, async (tx) => {
    await tx
      .insert(schema.benachrichtigungEinstellungen)
      .values({
        userId: user.id,
        emailAktiv: false,
        emailAdresse: adresse,
        adresseBestaetigtAm: null,
        doiTokenHash: hash,
        doiGesendetAm: jetzt,
      })
      .onConflictDoUpdate({
        target: schema.benachrichtigungEinstellungen.userId,
        set: {
          /* Eine neue Adresse ist eine neue Zustimmung. Der alte
             Nachweis gilt nicht für die neue Adresse. */
          emailAktiv: false,
          emailAdresse: adresse,
          adresseBestaetigtAm: null,
          doiTokenHash: hash,
          doiGesendetAm: jetzt,
          aktualisiertAm: jetzt,
        },
      });

    await tx.insert(schema.abmeldeToken).values({
      userId: user.id,
      tokenHash: hash,
      zweck: "bestaetigen",
      /* Sieben Tage. Ein Bestätigungslink, der ein Jahr gilt, ist
         kein Nachweis mehr für eine Entscheidung von heute. */
      gueltigBis: new Date(jetzt.getTime() + 7 * 86_400_000),
    });
  });

  const basis = loadRuntimeConfig().appUrl;
  const url = `${basis}/benachrichtigung/bestaetigen?t=${token}`;
  const antwort = await versendeMail({
    an: adresse,
    betreff: "Bestätige deine Jobmails",
    html: bestaetigungsHtml(url),
    text: bestaetigungsText(url),
  });

  revalidatePath("/app/suchauftraege");
  return antwort.ok
    ? { ok: true, entwurf: antwort.entwurf }
    : { ok: false, grund: "kein_versand" };
}

export type Bestaetigungsbefund =
  | { ok: true; adresse: string }
  | { ok: false; grund: "unbekannt" | "abgelaufen" | "verbraucht" };

/** Prüfen, ohne etwas zu ändern — für die Seite. */
export async function bestaetigungPruefen(token: string): Promise<Bestaetigungsbefund> {
  if (token.length < 16 || token.length > 128) return { ok: false, grund: "unbekannt" };
  const db = await getDb();
  return withSystem(db, async (tx) => {
    const r = (await tx.execute(sql`
      select t.user_id, t.gueltig_bis, t.verwendet_am, e.email_adresse
      from abmelde_token t
      left join benachrichtigung_einstellungen e on e.user_id = t.user_id
      where t.token_hash = ${abmeldeTokenHash(token)} and t.zweck = 'bestaetigen'
      limit 1`)) as unknown as {
      rows: {
        user_id: string;
        gueltig_bis: Date | null;
        verwendet_am: Date | null;
        email_adresse: string | null;
      }[];
    };
    const zeile = r.rows[0];
    if (!zeile) return { ok: false, grund: "unbekannt" as const };
    if (zeile.gueltig_bis !== null && zeile.gueltig_bis.getTime() < Date.now())
      return { ok: false, grund: "abgelaufen" as const };
    return { ok: true as const, adresse: zeile.email_adresse ?? "" };
  });
}

/**
 * Bestätigen. Nur über POST erreichbar.
 *
 * Erst hier wird `email_aktiv` wahr, und erst hier steht ein
 * Zeitpunkt in `adresse_bestaetigt_am` — der Nachweis, auf den sich
 * jeder spätere Versand stützt.
 */
export async function emailBestaetigen(token: string): Promise<Bestaetigungsbefund> {
  const geprueft = await bestaetigungPruefen(token);
  if (!geprueft.ok) return geprueft;

  const db = await getDb();
  const hash = abmeldeTokenHash(token);
  const jetzt = new Date();

  return withSystem(db, async (tx) => {
    const r = (await tx.execute(sql`
      select user_id from abmelde_token
      where token_hash = ${hash} and zweck = 'bestaetigen' limit 1`)) as unknown as {
      rows: { user_id: string }[];
    };
    const userId = r.rows[0]?.user_id;
    if (!userId) return { ok: false, grund: "unbekannt" as const };

    /*
     * Der Token muss noch der hinterlegte sein.
     *
     * Wer nach dem Absenden eine andere Adresse einträgt, bekommt
     * einen neuen Token. Der alte Link darf dann nicht mehr die neue
     * Adresse bestätigen — sonst bestätigte ein Klick auf die alte
     * Mail eine Adresse, die in ihr nie stand.
     */
    const zeilen = await tx
      .update(schema.benachrichtigungEinstellungen)
      .set({
        emailAktiv: true,
        adresseBestaetigtAm: jetzt,
        doiTokenHash: null,
        aktualisiertAm: jetzt,
      })
      .where(
        and(
          eq(schema.benachrichtigungEinstellungen.userId, userId),
          eq(schema.benachrichtigungEinstellungen.doiTokenHash, hash),
        ),
      )
      .returning({ adresse: schema.benachrichtigungEinstellungen.emailAdresse });

    if (zeilen.length === 0) return { ok: false, grund: "verbraucht" as const };

    /*
     * Die Einwilligung kommt ins Ledger.
     *
     * Zweck, Fassung und Zeitpunkt getrennt festgehalten — eine
     * Zustimmung, die nur als Häkchen existiert, lässt sich später
     * nicht belegen.
     */
    await tx.insert(schema.consents).values({
      userId,
      kind: "job_digest_email",
      granted: true,
      policyVersion: HINWEIS_FASSUNG,
      purpose: "Tägliche oder wöchentliche Zusammenfassung passender Stellen per E-Mail.",
      grantedAt: jetzt,
    });

    await tx.execute(sql`
      update abmelde_token set verwendet_am = now()
      where token_hash = ${hash} and verwendet_am is null`);

    return { ok: true as const, adresse: zeilen[0]!.adresse ?? "" };
  });
}

/** Die Fassung des Hinweistexts, dem zugestimmt wurde. */
const HINWEIS_FASSUNG = "jobmail-1";

function bestaetigungsText(url: string): string {
  return [
    "Hallo,",
    "",
    "du möchtest deine passenden Stellen künftig per E-Mail bekommen.",
    "Bestätige das bitte hier:",
    "",
    url,
    "",
    "Ohne diesen Klick geht keine Mail hinaus — die Treffer findest du",
    "weiterhin in Velvova.",
    "",
    "Wenn du das nicht angefordert hast, ignoriere diese Nachricht.",
    "Es passiert dann nichts.",
  ].join("\n");
}

function bestaetigungsHtml(url: string): string {
  /* Die Adresse steht in `href` und als Text darunter: Wer den Link
     nicht anklicken will, kann ihn lesen und selbst eingeben. */
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:24px 0">`,
    `<tr><td align="center">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:12px;padding:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827">`,
    `<tr><td style="font-size:15px;line-height:1.6">Hallo,</td></tr>`,
    `<tr><td style="font-size:15px;line-height:1.6;padding:8px 0 0">du möchtest deine passenden Stellen künftig per E-Mail bekommen. Bestätige das bitte:</td></tr>`,
    `<tr><td style="padding:20px 0"><a href="${url}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:600">Jobmails bestätigen</a></td></tr>`,
    `<tr><td style="font-size:12px;line-height:1.6;color:#6b7280">Ohne diesen Klick geht keine Mail hinaus — die Treffer findest du weiterhin in Velvova.<br>Wenn du das nicht angefordert hast, ignoriere diese Nachricht. Es passiert dann nichts.</td></tr>`,
    `<tr><td style="font-size:11px;color:#9ca3af;padding:14px 0 0;word-break:break-all">${url}</td></tr>`,
    `</table></td></tr></table>`,
  ].join("");
}

export interface Mailstand {
  adresse: string | null;
  aktiv: boolean;
  bestaetigt: boolean;
  wartetSeit: Date | null;
  /** Was auf diesem Server dem Versand entgegensteht. */
  fehlt: string[];
}

export async function mailstandLaden(): Promise<Mailstand> {
  const user = await requireUser();
  const db = await getDb();
  const stand = mailBereit();
  return withUser(db, user.id, async (tx) => {
    const [e] = await tx
      .select()
      .from(schema.benachrichtigungEinstellungen)
      .where(eq(schema.benachrichtigungEinstellungen.userId, user.id))
      .limit(1);
    return {
      adresse: e?.emailAdresse ?? null,
      aktiv: e?.emailAktiv ?? false,
      bestaetigt: e?.adresseBestaetigtAm !== null && e?.adresseBestaetigtAm !== undefined,
      wartetSeit: e?.adresseBestaetigtAm ? null : (e?.doiGesendetAm ?? null),
      fehlt: stand.bereit ? [] : stand.fehlt,
    };
  });
}
