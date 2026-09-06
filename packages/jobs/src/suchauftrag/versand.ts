import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { schema, withSystem, withUser, type Database } from "@paycheck/db";
import { ruhestand } from "@paycheck/matching";
import { auftragWartezeit, auftragDarfVersuchen } from "./warteschlange.ts";

/**
 * Den Versandausgang abarbeiten.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum unmittelbar vor der Übergabe noch einmal geprüft wird
 * ══════════════════════════════════════════════════════════════
 *
 * Zwischen dem Bauen der Zusammenfassung und dem Versand liegen
 * Minuten bis Stunden. In dieser Zeit kann jemand sich abmelden, sein
 * Konto löschen, den Auftrag beenden — oder eine Stelle kann
 * schliessen.
 *
 * Eine Mail, die nach der Abmeldung rausgeht, ist der Fall, den
 * niemand entschuldigt. Deshalb steht die Prüfung hier noch einmal,
 * obwohl sie beim Aktivieren schon lief.
 *
 * ══════════════════════════════════════════════════════════════
 * `accepted` ist nicht `delivered`
 * ══════════════════════════════════════════════════════════════
 *
 * Der Anbieter bestätigt die Annahme. Ob die Mail im Postfach liegt,
 * weiss er in diesem Moment selbst nicht. Beides in einen Zustand zu
 * legen hiesse, eine Zustellung zu behaupten, die niemand geprüft hat.
 *
 * ══════════════════════════════════════════════════════════════
 * Und warum es `unknown` gibt
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Zeitüberschreitung NACH der Übergabe ist der unangenehmste
 * Fall: Die Mail kann draussen sein oder nicht. Der bequeme Weg wäre,
 * sie mit neuem Schlüssel noch einmal zu schicken — und dann bekommt
 * die Person sie zweimal.
 *
 * `unknown` heisst: Wir wissen es nicht, und wir tun so lange nichts,
 * bis ein Webhook oder eine Nachfrage es klärt. Das ist ehrlicher als
 * eine behauptete Exactly-once-Zustellung.
 */

export type Versandzustand =
  | "queued"
  | "sending"
  | "accepted"
  | "delivered"
  | "failed"
  | "suppressed"
  | "unknown";

export interface Versandauftrag {
  id: string;
  userId: string;
  zusammenfassungId: string | null;
  idempotenzSchluessel: string;
  an: string;
  betreff: string;
  html: string;
  text: string;
  /** Für die Kopfzeile `List-Unsubscribe`. */
  abmeldeUrl: string | null;
  versuche: number;
}

export type Versandantwort =
  | { ok: true; anbieterId: string | null; anbieter: string }
  | { ok: false; art: "dauerhaft" | "vorübergehend" | "ungewiss"; text: string };

/** Was der Aufrufer mitbringt: der eigentliche Versandweg. */
export type Versender = (a: Versandauftrag) => Promise<Versandantwort>;

export interface Versandlauf {
  angenommen: number;
  wiederholt: number;
  gescheitert: number;
  unterdrueckt: number;
  ungewiss: number;
}

/** Höchstens so viele je Lauf — der Rest wartet auf den nächsten. */
export const VERSAND_STAPEL = 50;

export async function ausgangAbarbeiten(
  db: Database,
  versenden: Versender,
  optionen: { jetzt?: Date; stapel?: number } = {},
): Promise<Versandlauf> {
  const jetzt = optionen.jetzt ?? new Date();
  const lauf: Versandlauf = { angenommen: 0, wiederholt: 0, gescheitert: 0, unterdrueckt: 0, ungewiss: 0 };

  const offen = await withSystem(db, (tx) =>
    tx
      .select()
      .from(schema.mailAusgang)
      .where(
        and(
          eq(schema.mailAusgang.zustand, "queued"),
          or(isNull(schema.mailAusgang.naechsterVersuch), lte(schema.mailAusgang.naechsterVersuch, jetzt)),
        ),
      )
      .limit(optionen.stapel ?? VERSAND_STAPEL),
  );

  for (const zeile of offen) {
    /*
     * Die Übernahme ist ein bedingtes UPDATE, kein Lesen und
     * Schreiben. Zwei Worker, die dieselbe Zeile sehen, holen sich
     * sonst beide die Arbeit — und die Mail geht zweimal raus.
     */
    const uebernommen = await withSystem(db, (tx) =>
      tx
        .update(schema.mailAusgang)
        .set({ zustand: "sending", versuche: zeile.versuche + 1, aktualisiertAm: jetzt })
        .where(and(eq(schema.mailAusgang.id, zeile.id), eq(schema.mailAusgang.zustand, "queued")))
        .returning({ id: schema.mailAusgang.id }),
    );
    if (uebernommen.length === 0) continue;

    const hindernis = await versandHindernis(db, zeile.userId, zeile.an);
    if (hindernis !== null) {
      await withSystem(db, (tx) =>
        tx
          .update(schema.mailAusgang)
          .set({ zustand: "suppressed", fehler: hindernis, aktualisiertAm: jetzt })
          .where(eq(schema.mailAusgang.id, zeile.id)),
      );
      lauf.unterdrueckt++;
      continue;
    }

    const antwort = await versenden({
      id: zeile.id,
      userId: zeile.userId,
      zusammenfassungId: zeile.zusammenfassungId,
      idempotenzSchluessel: zeile.idempotenzSchluessel,
      an: zeile.an,
      betreff: zeile.betreff,
      html: zeile.html,
      text: zeile.text,
      abmeldeUrl: zeile.abmeldeUrl,
      versuche: zeile.versuche + 1,
    });

    if (antwort.ok) {
      await withSystem(db, (tx) =>
        tx
          .update(schema.mailAusgang)
          .set({
            zustand: "accepted",
            anbieter: antwort.anbieter,
            anbieterId: antwort.anbieterId,
            gesendetAm: jetzt,
            aktualisiertAm: jetzt,
            fehler: null,
          })
          .where(eq(schema.mailAusgang.id, zeile.id)),
      );
      if (zeile.zusammenfassungId) await nachVersandBuchen(db, zeile.userId, zeile.zusammenfassungId, jetzt);
      lauf.angenommen++;
      continue;
    }

    if (antwort.art === "ungewiss") {
      /*
       * Nicht wiederholen. Siehe oben: Die Mail kann draussen sein.
       */
      await withSystem(db, (tx) =>
        tx
          .update(schema.mailAusgang)
          .set({ zustand: "unknown", fehler: antwort.text.slice(0, 400), aktualisiertAm: jetzt })
          .where(eq(schema.mailAusgang.id, zeile.id)),
      );
      lauf.ungewiss++;
      continue;
    }

    const versuche = zeile.versuche + 1;
    const nochmal = antwort.art === "vorübergehend" && auftragDarfVersuchen(versuche);
    await withSystem(db, (tx) =>
      tx
        .update(schema.mailAusgang)
        .set({
          zustand: nochmal ? "queued" : "failed",
          /*
           * Der Idempotenzschlüssel bleibt unverändert. Ein neuer bei
           * jedem Versuch wäre für den Anbieter eine neue Mail.
           */
          naechsterVersuch: nochmal
            ? new Date(jetzt.getTime() + auftragWartezeit(versuche, 0.5) * 1000)
            : null,
          fehler: antwort.text.slice(0, 400),
          aktualisiertAm: jetzt,
        })
        .where(eq(schema.mailAusgang.id, zeile.id)),
    );
    if (nochmal) lauf.wiederholt++;
    else lauf.gescheitert++;
  }

  return lauf;
}

/**
 * Was gegen den Versand spricht — unmittelbar vor der Übergabe.
 *
 * `null` heisst: nichts. Jeder andere Wert ist ein Grund, der
 * gespeichert wird — nicht nur ein Abbruch.
 */
export async function versandHindernis(
  db: Database,
  userId: string,
  adresse: string,
): Promise<string | null> {
  return withSystem(db, async (tx) => {
    const sperren = (await tx.execute(
      sql`select grund from unterdrueckungen where lower(email) = lower(${adresse}) limit 1`,
    )) as unknown as { rows: { grund: string }[] };
    if (sperren.rows.length > 0) return `unterdrueckt:${sperren.rows[0]!.grund}`;

    const nutzer = (await tx.execute(
      sql`select deleted_at from users where id = ${userId}::uuid limit 1`,
    )) as unknown as { rows: { deleted_at: Date | null }[] };
    if (nutzer.rows.length === 0) return "konto_fehlt";
    if (nutzer.rows[0]!.deleted_at !== null) return "konto_geloescht";

    const einstellung = (await tx.execute(
      sql`select email_aktiv, adresse_bestaetigt_am, email_adresse, pausiert_bis, zuletzt_aktiv_am
          from benachrichtigung_einstellungen where user_id = ${userId}::uuid limit 1`,
    )) as unknown as {
      rows: {
        email_aktiv: boolean;
        adresse_bestaetigt_am: Date | null;
        email_adresse: string | null;
        pausiert_bis: Date | null;
        zuletzt_aktiv_am: Date | null;
      }[];
    };
    const e = einstellung.rows[0];
    if (!e || !e.email_aktiv) return "keine_zustimmung";
    if (e.adresse_bestaetigt_am === null) return "adresse_unbestaetigt";
    /*
     * Die Adresse muss noch dieselbe sein.
     *
     * Wer sie zwischendurch geändert hat, soll die Mail nicht an die
     * alte bekommen — und die neue ist noch nicht bestätigt.
     */
    if ((e.email_adresse ?? "").toLowerCase() !== adresse.toLowerCase()) return "adresse_geaendert";
    if (e.pausiert_bis !== null && e.pausiert_bis.getTime() > Date.now()) return "pausiert";

    /*
     * Wer lange nicht da war, bekommt keine Post mehr.
     *
     * Nicht abgemeldet — Inaktivität ist kein Widerruf. Vielleicht hat
     * jemand eine Stelle gefunden, vielleicht war er krank. Die Mails
     * ruhen, und beim nächsten Besuch wird gefragt.
     *
     * Gemessen wird App-Aktivität, nicht das Öffnen einer Mail. Ein
     * Öffnungspixel misst Postfacheinstellungen, nicht Interesse — und
     * ihn stillschweigend zu setzen wäre Beobachtung ohne Anlass.
     */
    const ruhe = ruhestand(e.zuletzt_aktiv_am ?? null, new Date());
    if (ruhe.ruhend) return `ruhend:${ruhe.tage}`;

    const aktiv = (await tx.execute(
      sql`select count(*)::int as n from such_auftraege
          where user_id = ${userId}::uuid and status = 'aktiv'`,
    )) as unknown as { rows: { n: number }[] };
    if ((aktiv.rows[0]?.n ?? 0) === 0) return "kein_aktiver_auftrag";

    return null;
  });
}

/**
 * Nach der Annahme buchen, was als gemeldet gilt.
 *
 * Erst hier — nicht beim Entwurf. Sonst hiesse ein gescheiterter
 * Versand: Die Stelle gilt als gemeldet und kommt nie wieder.
 */
async function nachVersandBuchen(
  db: Database,
  userId: string,
  zusammenfassungId: string,
  jetzt: Date,
): Promise<void> {
  await withUser(db, userId, async (tx) => {
    const posten = await tx
      .select()
      .from(schema.zusammenfassungPosten)
      .where(eq(schema.zusammenfassungPosten.zusammenfassungId, zusammenfassungId));
    if (posten.length === 0) return;

    for (const p of posten) {
      await tx
        .insert(schema.jobBenachrichtigungen)
        .values({
          userId,
          kanonischeJobId: p.kanonischeJobId,
          materielleFassung: p.materielleFassung,
          zuerstAm: jetzt,
          zuletztAm: jetzt,
        })
        .onConflictDoUpdate({
          target: [schema.jobBenachrichtigungen.userId, schema.jobBenachrichtigungen.kanonischeJobId],
          set: {
            materielleFassung: p.materielleFassung,
            zuletztAm: jetzt,
            anzahl: sql`${schema.jobBenachrichtigungen.anzahl} + 1`,
          },
        });
    }

    await tx
      .update(schema.auftragTreffer)
      .set({ zustand: "benachrichtigt" })
      .where(inArray(schema.auftragTreffer.id, posten.map((p) => p.trefferId)));

    await tx
      .update(schema.zusammenfassungen)
      .set({ zustand: "versendet" })
      .where(eq(schema.zusammenfassungen.id, zusammenfassungId));
  });
}

/**
 * Ein Zustellereignis des Anbieters festhalten.
 *
 * ── Warum die Reihenfolge nicht garantiert ist ────────────────
 *
 * Webhooks kommen doppelt und verspätet. Ein `delivered`, das nach
 * einem `bounced` eintrifft, darf den Bounce nicht überschreiben —
 * sonst verwandelt sich eine tote Adresse in eine funktionierende.
 *
 * Deshalb sind die Zustände geordnet, und ein Ereignis darf nur nach
 * vorne schieben.
 */
const RANG: Record<string, number> = {
  queued: 0,
  sending: 1,
  unknown: 2,
  accepted: 3,
  delivered: 4,
  failed: 5,
  suppressed: 6,
};

export async function zustellereignisBuchen(
  db: Database,
  ereignis: {
    anbieterEreignisId: string | null;
    anbieterId: string | null;
    art: string;
    nutzlast?: Record<string, unknown>;
    ereignisAm?: Date | null;
  },
): Promise<{ gebucht: boolean; grund?: string }> {
  return withSystem(db, async (tx) => {
    const zuordnung = ereignis.anbieterId
      ? ((await tx.execute(
          sql`select id, user_id, an, zustand from mail_ausgang where anbieter_id = ${ereignis.anbieterId} limit 1`,
        )) as unknown as { rows: { id: string; user_id: string; an: string; zustand: string }[] })
      : { rows: [] as { id: string; user_id: string; an: string; zustand: string }[] };
    const ausgang = zuordnung.rows[0] ?? null;

    const eingefuegt = await tx
      .insert(schema.zustellEreignisse)
      .values({
        ausgangId: ausgang?.id ?? null,
        anbieterEreignisId: ereignis.anbieterEreignisId,
        art: ereignis.art,
        nutzlast: ereignis.nutzlast ?? {},
        ereignisAm: ereignis.ereignisAm ?? null,
      })
      .onConflictDoNothing({ target: [schema.zustellEreignisse.anbieterEreignisId] })
      .returning({ id: schema.zustellEreignisse.id });

    /* Schon gesehen — Webhooks kommen doppelt. Kein Fehler. */
    if (eingefuegt.length === 0) return { gebucht: false, grund: "doppelt" };
    if (!ausgang) return { gebucht: true, grund: "ohne_zuordnung" };

    const neuerZustand =
      ereignis.art === "delivered"
        ? "delivered"
        : ereignis.art === "bounced" || ereignis.art === "complained"
          ? "failed"
          : null;
    if (neuerZustand === null) return { gebucht: true };

    /* Nur nach vorne. Ein verspätetes `delivered` hebt keinen Bounce auf. */
    if ((RANG[neuerZustand] ?? 0) <= (RANG[ausgang.zustand] ?? 0)) return { gebucht: true, grund: "nicht_zurueck" };

    await tx
      .update(schema.mailAusgang)
      .set({ zustand: neuerZustand, aktualisiertAm: new Date() })
      .where(eq(schema.mailAusgang.id, ausgang.id));

    /*
     * Ein harter Bounce und eine Beschwerde sperren die Adresse.
     *
     * Ohne Nutzerbezug: Sie bleibt gesperrt, auch wenn sie später zu
     * einem anderen Konto gehört. Wer sich beschwert hat, hat sich
     * über die Adresse beschwert.
     */
    if (ereignis.art === "bounced" || ereignis.art === "complained") {
      await tx
        .insert(schema.unterdrueckungen)
        .values({
          email: ausgang.an,
          grund: ereignis.art === "bounced" ? "hard_bounce" : "beschwerde",
          quelle: "webhook",
        })
        .onConflictDoNothing();
    }

    return { gebucht: true };
  });
}
