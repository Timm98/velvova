import "server-only";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import type { MatchZustand } from "@paycheck/db/schema";

/**
 * Vorschläge und ihre Einwilligungskette.
 *
 * ══════════════════════════════════════════════════════════════
 * Die eine Regel, an der alles hängt
 * ══════════════════════════════════════════════════════════════
 *
 * Name und Kontaktadresse verlassen die Datenbank erst, wenn der
 * Zustand `kontakt_offen` erreicht ist. Nicht „werden dann angezeigt" —
 * sie werden vorher gar nicht erst abgefragt.
 *
 * Der Unterschied ist der ganze Punkt. Ein Feld, das geladen und in
 * der Oberfläche ausgeblendet wird, steht im Netzwerkverkehr, im
 * Zwischenspeicher des Browsers und in jedem Fehlerbericht. Eine
 * Ausblendung ist eine Bitte an die Anzeige; ein nicht geladenes Feld
 * ist eine Tatsache.
 *
 * Deshalb gibt es hier zwei Abfragen und nicht eine mit einer
 * Bedingung im JSX.
 */

/* ══════════════════════════════════════════════════════════════
   Die Zustandsmaschine
   ══════════════════════════════════════════════════════════════ */

/**
 * Welcher Zustand auf welchen folgen darf.
 *
 * ── Warum als Tabelle und nicht als `if` an den Aufrufstellen ──
 *
 * Weil sonst jede neue Aktion ihre eigene Vorstellung davon mitbringt,
 * was erlaubt ist. Bei einer Einwilligungskette ist das der Weg zu
 * einem Kontakt, der sich öffnet, ohne dass jemand zugestimmt hat —
 * und zwar nicht durch böse Absicht, sondern durch eine Zeile, die
 * einen Schritt übersprang.
 *
 * Was hier nicht steht, ist nicht möglich.
 */
const UEBERGAENGE: Record<MatchZustand, MatchZustand[]> = {
  anonym_erkannt: ["freigabe_angefragt", "abgelehnt", "abgelaufen"],
  freigabe_angefragt: ["profil_freigegeben", "abgelehnt", "abgelaufen"],
  /* Nach der Freigabe darf das Unternehmen Interesse zeigen — und die
     Person kann sie jederzeit zurücknehmen. */
  profil_freigegeben: ["interesse_gesendet", "abgelehnt", "freigabe_widerrufen", "abgelaufen"],
  interesse_gesendet: ["gegenseitiges_interesse", "abgelehnt", "freigabe_widerrufen", "abgelaufen"],
  /* Der Kontakt öffnet sich nur aus dem gegenseitigen Interesse. Es
     gibt keinen anderen Weg zu `kontakt_offen`. */
  gegenseitiges_interesse: ["kontakt_offen", "abgelehnt", "freigabe_widerrufen"],
  kontakt_offen: ["abgelehnt", "freigabe_widerrufen"],
  /* Endzustände. Ein abgelehnter Vorschlag wird nicht wiederbelebt —
     ein neuer Lauf legt einen neuen an, mit neuer Bewertung. */
  abgelehnt: [],
  freigabe_widerrufen: [],
  abgelaufen: [],
};

/** Ab hier sind Name und Kontaktadresse sichtbar — und nur ab hier. */
export const KONTAKT_SICHTBAR: MatchZustand[] = ["kontakt_offen"];

/** Ab hier darf das Unternehmen freigegebene Profilangaben sehen. */
export const PROFIL_SICHTBAR: MatchZustand[] = [
  "profil_freigegeben",
  "interesse_gesendet",
  "gegenseitiges_interesse",
  "kontakt_offen",
];

export const ZUSTANDSNAME: Record<MatchZustand, string> = {
  anonym_erkannt: "Anonym erkannt",
  freigabe_angefragt: "Freigabe angefragt",
  profil_freigegeben: "Profil freigegeben",
  interesse_gesendet: "Interesse gesendet",
  gegenseitiges_interesse: "Gegenseitiges Interesse",
  kontakt_offen: "Kontakt geöffnet",
  abgelehnt: "Abgelehnt",
  freigabe_widerrufen: "Freigabe widerrufen",
  abgelaufen: "Anfrage abgelaufen",
};

export function darfWechseln(von: MatchZustand, nach: MatchZustand): boolean {
  return UEBERGAENGE[von]?.includes(nach) ?? false;
}

/* ══════════════════════════════════════════════════════════════
   Lesen
   ══════════════════════════════════════════════════════════════ */

export type MatchFilter = {
  postingId?: string;
  minFit?: number;
  zustaende?: MatchZustand[];
};

/**
 * Ein Vorschlag, wie ihn ein Unternehmen sehen darf.
 *
 * `kennung` ist keine Kennung der Person, sondern des Vorschlags — die
 * ersten acht Zeichen seiner eigenen Kennung. Über sie lässt sich
 * nichts nachschlagen, und zwei Vorschläge derselben Person zu zwei
 * Stellen tragen verschiedene. Genau das ist gewollt: Wer anonyme
 * Vorschläge über mehrere Stellen hinweg zusammenführen könnte, hätte
 * die Anonymität aufgehoben.
 */
export type Vorschlag = {
  id: string;
  kennung: string;
  postingId: string;
  stellentitel: string;
  fitGesamt: number | null;
  fitFachlich: number | null;
  fitPersoenlich: number | null;
  fitLangfristig: number | null;
  band: string;
  datenbasis: number;
  belegt: string[];
  offen: string[];
  entwickelbar: string[];
  ausschluss: string[];
  gehaltUeberschneidung: string | null;
  verfuegbarkeit: string | null;
  zustand: MatchZustand;
  erstelltAm: Date;
  /** Nur bei `kontakt_offen` gefüllt. Sonst `null` — nicht geladen. */
  name: string | null;
  kontakt: string | null;
};

export async function vorschlaegeLaden(
  organizationId: string,
  filter: MatchFilter = {},
): Promise<Vorschlag[]> {
  const db = await getDb();

  const wo = [eq(schema.stellenMatches.organizationId, organizationId)];
  if (filter.postingId) wo.push(eq(schema.stellenMatches.postingId, filter.postingId));
  if (filter.minFit) wo.push(gte(schema.stellenMatches.fitGesamt, filter.minFit));
  if (filter.zustaende?.length) wo.push(inArray(schema.stellenMatches.zustand, filter.zustaende));

  /*
   * Erste Abfrage: alles ausser Name und Kontakt.
   *
   * Sie läuft für jeden Vorschlag, unabhängig vom Zustand. Was sie
   * liefert, darf ein Unternehmen in jedem Zustand sehen: die
   * Bewertung, die Begründung, den Zustand selbst.
   */
  const zeilen = await db
    .select({
      id: schema.stellenMatches.id,
      postingId: schema.stellenMatches.postingId,
      stellentitel: schema.jobPostings.title,
      fitGesamt: schema.stellenMatches.fitGesamt,
      fitFachlich: schema.stellenMatches.fitFachlich,
      fitPersoenlich: schema.stellenMatches.fitPersoenlich,
      fitLangfristig: schema.stellenMatches.fitLangfristig,
      band: schema.stellenMatches.band,
      datenbasis: schema.stellenMatches.datenbasis,
      belegt: schema.stellenMatches.belegt,
      offen: schema.stellenMatches.offen,
      entwickelbar: schema.stellenMatches.entwickelbar,
      ausschluss: schema.stellenMatches.ausschluss,
      gehaltUeberschneidung: schema.stellenMatches.gehaltUeberschneidung,
      verfuegbarkeit: schema.stellenMatches.verfuegbarkeit,
      zustand: schema.stellenMatches.zustand,
      erstelltAm: schema.stellenMatches.erstelltAm,
    })
    .from(schema.stellenMatches)
    .innerJoin(schema.jobPostings, eq(schema.jobPostings.id, schema.stellenMatches.postingId))
    .where(and(...wo))
    .orderBy(desc(schema.stellenMatches.fitGesamt), desc(schema.stellenMatches.erstelltAm))
    .limit(200);

  /*
   * Zweite Abfrage: Name und Kontakt — nur für die Vorschläge, bei
   * denen der Kontakt offen ist.
   *
   * Bei keinem einzigen offenen Kontakt läuft sie gar nicht. Das ist
   * kein Sparen an einer Abfrage, sondern die Umsetzung der Regel: Es
   * gibt keinen Programmpfad, auf dem ein Name geladen wird, ohne dass
   * vorher der Zustand geprüft wurde.
   */
  const offeneKontakte = zeilen.filter((z) => KONTAKT_SICHTBAR.includes(z.zustand)).map((z) => z.id);
  const kontakte = new Map<string, { name: string; kontakt: string }>();

  if (offeneKontakte.length > 0) {
    const daten = await db
      .select({
        id: schema.stellenMatches.id,
        name: schema.users.displayName,
        email: schema.users.email,
        phone: schema.users.phone,
      })
      .from(schema.stellenMatches)
      .innerJoin(schema.users, eq(schema.users.id, schema.stellenMatches.candidateUserId))
      .where(
        and(
          inArray(schema.stellenMatches.id, offeneKontakte),
          /* Der Zustand steht auch hier in der Bedingung. Zwischen den
             beiden Abfragen kann er sich geändert haben — und dann gilt
             der neue. */
          inArray(schema.stellenMatches.zustand, KONTAKT_SICHTBAR),
        ),
      );
    for (const d of daten) {
      kontakte.set(d.id, { name: d.name ?? "Ohne Namen", kontakt: d.email ?? d.phone ?? "" });
    }
  }

  return zeilen.map((z) => ({
    ...z,
    /* Acht Zeichen: genug, um im Team über „den mit 7f3a" zu sprechen,
       zu wenig, um daraus etwas abzuleiten. */
    kennung: z.id.slice(0, 8),
    name: kontakte.get(z.id)?.name ?? null,
    kontakt: kontakte.get(z.id)?.kontakt ?? null,
  }));
}

/** Wie viele Vorschläge je Zustand — für Filter und Übersicht. */
export async function vorschlagsZahlen(
  organizationId: string,
): Promise<Record<string, number>> {
  const db = await getDb();
  const zeilen = await db
    .select({ zustand: schema.stellenMatches.zustand, n: sql<number>`count(*)::int` })
    .from(schema.stellenMatches)
    .where(eq(schema.stellenMatches.organizationId, organizationId))
    .groupBy(schema.stellenMatches.zustand);
  return Object.fromEntries(zeilen.map((z) => [z.zustand, z.n]));
}

/* ══════════════════════════════════════════════════════════════
   Schreiben
   ══════════════════════════════════════════════════════════════ */

/** Welcher Zeitstempel zu welchem Zustand gehört. */
const STEMPEL: Partial<Record<MatchZustand, keyof typeof schema.stellenMatches.$inferInsert>> = {
  freigabe_angefragt: "freigabeAngefragtAm",
  profil_freigegeben: "freigabeErteiltAm",
  interesse_gesendet: "interesseUnternehmenAm",
  gegenseitiges_interesse: "interessePersonAm",
  kontakt_offen: "kontaktOffenAm",
  abgelehnt: "abgelehntAm",
  freigabe_widerrufen: "freigabeWiderrufenAm",
};

export type WechselErgebnis = { ok: boolean; fehler?: string };

/**
 * Einen Vorschlag in den nächsten Zustand bringen.
 *
 * ── Warum der aktuelle Zustand mit in die Bedingung geht ──────
 *
 * `where zustand = <erwartet>` macht aus zwei Schritten einen. Ohne
 * das läge zwischen Lesen und Schreiben ein Moment, in dem die Person
 * ihre Freigabe widerrufen kann — und der Widerruf ginge verloren,
 * weil das Unternehmen gleichzeitig „Interesse senden" gedrückt hat.
 *
 * Trifft die Bedingung nicht, wird nichts geschrieben, und der Aufrufer
 * erfährt es.
 */
export async function zustandWechseln(opt: {
  matchId: string;
  organizationId: string;
  von: MatchZustand;
  nach: MatchZustand;
  /** Wer es ausgelöst hat — eine Nutzerkennung oder „regel". */
  akteur: string;
  begruendung?: string;
  /** Für RLS: unter wessen Sitzung geschrieben wird. */
  userId: string;
}): Promise<WechselErgebnis> {
  if (!darfWechseln(opt.von, opt.nach)) {
    return {
      ok: false,
      fehler: `Aus „${ZUSTANDSNAME[opt.von]}" führt kein Weg nach „${ZUSTANDSNAME[opt.nach]}".`,
    };
  }

  const db = await getDb();
  const feld = STEMPEL[opt.nach];

  const ergebnis = await withUser(db, opt.userId, (tx) =>
    tx
      .update(schema.stellenMatches)
      .set({
        zustand: opt.nach,
        aktualisiertAm: new Date(),
        ...(feld ? { [feld]: new Date() } : {}),
        ...(opt.nach === "abgelehnt" ? { abgelehntVon: opt.akteur } : {}),
      })
      .where(
        and(
          eq(schema.stellenMatches.id, opt.matchId),
          eq(schema.stellenMatches.organizationId, opt.organizationId),
          eq(schema.stellenMatches.zustand, opt.von),
        ),
      )
      .returning({ id: schema.stellenMatches.id }),
  );

  if (ergebnis.length === 0) {
    return {
      ok: false,
      fehler: "Der Vorschlag hat sich inzwischen geändert. Lade die Seite neu.",
    };
  }

  await protokolliereMatch({
    organizationId: opt.organizationId,
    matchId: opt.matchId,
    ausgeloestVon: opt.akteur,
    handlung: `${opt.von} → ${opt.nach}`,
    begruendung: opt.begruendung ?? "",
    userId: opt.userId,
  });

  return { ok: true };
}

export async function protokolliereMatch(opt: {
  organizationId: string;
  matchId: string | null;
  ausgeloestVon: string;
  handlung: string;
  begruendung?: string;
  userId: string;
}): Promise<void> {
  const db = await getDb();
  await withUser(db, opt.userId, (tx) =>
    tx.insert(schema.matchProtokoll).values({
      organizationId: opt.organizationId,
      matchId: opt.matchId,
      ausgeloestVon: opt.ausgeloestVon,
      handlung: opt.handlung,
      begruendung: opt.begruendung ?? "",
    }),
  ).catch(() => undefined);
}

/* ══════════════════════════════════════════════════════════════
   Regeln
   ══════════════════════════════════════════════════════════════ */

export type Regel = {
  stufe: 1 | 2 | 3;
  minFit: number;
  pausiert: boolean;
  postingId: string | null;
};

export const STUFENNAME: Record<1 | 2 | 3, string> = {
  1: "Nur Vorschläge",
  2: "Freigaben automatisch anfragen",
  3: "Automatisch verbinden",
};

export const STUFENERKLAERUNG: Record<1 | 2 | 3, string> = {
  1: "Monday rechnet und legt Vorschläge an. Jede Anfrage an eine Person löst ein Mensch aus.",
  2: "Monday fragt die Profilfreigabe selbst an, sobald ein Vorschlag die Bedingungen erfüllt. Ob ihr danach Interesse sendet, entscheidet ihr.",
  3: "Monday öffnet den Kontakt selbst — aber nur, wenn beide Seiten diese Kontaktart vorher erlaubt haben und alle Bedingungen erfüllt sind.",
};

export async function regelLaden(
  organizationId: string,
  postingId: string | null = null,
): Promise<Regel> {
  const db = await getDb();
  const [zeile] = await db
    .select()
    .from(schema.matchRegeln)
    .where(
      and(
        eq(schema.matchRegeln.organizationId, organizationId),
        postingId
          ? eq(schema.matchRegeln.postingId, postingId)
          : sql`${schema.matchRegeln.postingId} is null`,
      ),
    )
    .limit(1);

  /* Ohne Zeile gilt Stufe 1 — nicht, weil nichts eingestellt ist,
     sondern weil das die Vorgabe ist und bleibt. */
  if (!zeile) return { stufe: 1, minFit: 80, pausiert: false, postingId };
  return {
    stufe: (zeile.stufe === 2 || zeile.stufe === 3 ? zeile.stufe : 1) as 1 | 2 | 3,
    minFit: zeile.minFit,
    pausiert: zeile.pausiertAm !== null,
    postingId: zeile.postingId,
  };
}
