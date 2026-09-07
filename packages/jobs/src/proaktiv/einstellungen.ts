import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { schema, withUser, type Database } from "@paycheck/db";
import { ZURUECKHALTUNG, type Eigeninitiative, type Zustand } from "@paycheck/matching";

/**
 * Was die Person erlaubt, und wie oft Monday schon gesprochen hat.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Zustand aus der Datenbank kommt und nicht aus dem Prozess
 * ══════════════════════════════════════════════════════════════
 *
 * Weil es mehrere Prozesse gibt. Der Chat läuft im Webserver, die
 * Sprachausgabe woanders, ein Hintergrunddienst wieder anders. Ein
 * Zähler im Arbeitsspeicher wäre dreimal vorhanden und dreimal
 * niedrig — und die Person bekäme das Dreifache dessen, was die
 * Regeln erlauben.
 */

const GRUNDSTUFE: Eigeninitiative = "ausgeglichen";

function stufeLesen(roh: string | null | undefined): Eigeninitiative {
  return roh === "zurueckhaltend" || roh === "proaktiv" ? roh : GRUNDSTUFE;
}

/**
 * Wie lange zurück eine Ablehnung noch zählt.
 *
 * Die längste Sperre der drei Stufen — beim Laden ist noch nicht
 * entschieden, welche gilt, und lieber zu viel geladen als eine
 * Ablehnung übersehen.
 */
const ABLEHNUNG_MAX_TAGE = Math.max(
  ...Object.values(ZURUECKHALTUNG).map((z) => z.abgelehntTage),
);

export async function zustandLaden(
  db: Database,
  userId: string,
  sitzungId: string | null,
  jetzt = new Date(),
): Promise<Zustand> {
  return withUser(db, userId, async (tx) => {
    const [e] = await tx
      .select()
      .from(schema.ninaEigeninitiative)
      .where(eq(schema.ninaEigeninitiative.userId, userId))
      .limit(1);

    const seit = new Date(jetzt.getTime() - ABLEHNUNG_MAX_TAGE * 24 * 60 * 60 * 1000);
    const abgelehnteZeilen = await tx
      .select({
        handlung: schema.ninaHandlungen.handlung,
        entschiedenAm: schema.ninaHandlungen.entschiedenAm,
      })
      .from(schema.ninaHandlungen)
      .where(
        and(
          eq(schema.ninaHandlungen.userId, userId),
          inArray(schema.ninaHandlungen.zustand, ["abgelehnt", "rueckgaengig"]),
          gte(schema.ninaHandlungen.erstelltAm, seit),
        ),
      );

    const abgelehnt = new Map<string, Date>();
    for (const z of abgelehnteZeilen) {
      const wann = z.entschiedenAm ?? jetzt;
      const bisher = abgelehnt.get(z.handlung);
      if (!bisher || wann > bisher) abgelehnt.set(z.handlung, wann);
    }

    /*
     * Themen der laufenden Sitzung.
     *
     * Nur diese Sitzung: Dasselbe Thema morgen wieder anzusprechen ist
     * in Ordnung, zweimal in derselben halben Stunde nicht.
     */
    const themen = new Set<string>();
    if (sitzungId) {
      const zeilen = await tx
        .select({ handlung: schema.ninaHandlungen.handlung })
        .from(schema.ninaHandlungen)
        .where(
          and(
            eq(schema.ninaHandlungen.userId, userId),
            sql`${schema.ninaHandlungen.nachricht} is not null`,
            gte(
              schema.ninaHandlungen.erstelltAm,
              new Date(jetzt.getTime() - 12 * 60 * 60 * 1000),
            ),
          ),
        );
      for (const z of zeilen) themen.add(z.handlung);
    }

    /* Ein Zähler aus einer anderen Sitzung sagt nichts über diese. */
    const gleicheSitzung = sitzungId !== null && e?.sitzungId === sitzungId;

    return {
      letzteNachricht: e?.letzteNachrichtAm ?? null,
      inSitzung: gleicheSitzung ? (e?.inSitzung ?? 0) : 0,
      themenDerSitzung: themen,
      abgelehnt,
      abgeschaltet: new Set(e?.abgeschaltet ?? []),
      einstellung: stufeLesen(e?.stufe),
    };
  });
}

/**
 * Vermerken, dass Monday gesprochen hat.
 *
 * ── Warum der Sitzungszähler hier zurückgesetzt wird ──────────
 *
 * Weil eine neue Sitzung von vorn anfängt. Ohne das Zurücksetzen
 * trüge jemand, der gestern drei Hinweise bekommen hat, das Limit
 * heute noch mit sich — und Monday bliebe für immer stumm.
 */
export async function nachrichtVermerken(
  db: Database,
  userId: string,
  sitzungId: string | null,
  jetzt: Date,
): Promise<void> {
  await withUser(db, userId, async (tx) => {
    await tx
      .insert(schema.ninaEigeninitiative)
      .values({
        userId,
        letzteNachrichtAm: jetzt,
        inSitzung: 1,
        sitzungId,
        aktualisiertAm: jetzt,
      })
      .onConflictDoUpdate({
        target: schema.ninaEigeninitiative.userId,
        set: {
          letzteNachrichtAm: jetzt,
          inSitzung: sql`case when ${schema.ninaEigeninitiative.sitzungId} is not distinct from ${sitzungId}
                              then ${schema.ninaEigeninitiative.inSitzung} + 1 else 1 end`,
          sitzungId,
          aktualisiertAm: jetzt,
        },
      });
  });
}

/* ═══════════════════════════════════════════════════════════════
   Die Antwort der Person
   ═══════════════════════════════════════════════════════════════ */

export type Antwort = "behalten" | "verworfen";

/**
 * Eine automatische Handlung zurücknehmen oder bestätigen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das Zurücknehmen zwei Dinge tut
 * ══════════════════════════════════════════════════════════════
 *
 * Es macht die Wirkung rückgängig UND vermerkt die Ablehnung. Nur das
 * erste wäre eine Schaltfläche, die nichts lernt: Monday merkte die
 * Stelle beim nächsten Lauf wieder vor, und die Person müsste
 * dieselbe Sache noch einmal wegklicken.
 */
export async function handlungBeantworten(
  db: Database,
  userId: string,
  handlungId: string,
  antwort: Antwort,
  jetzt = new Date(),
): Promise<{ ok: boolean }> {
  return withUser(db, userId, async (tx) => {
    const [h] = await tx
      .select()
      .from(schema.ninaHandlungen)
      .where(
        and(eq(schema.ninaHandlungen.id, handlungId), eq(schema.ninaHandlungen.userId, userId)),
      )
      .limit(1);
    if (!h) return { ok: false };

    const neuerZustand =
      antwort === "behalten"
        ? h.zustand === "vorgeschlagen"
          ? "zugestimmt"
          : "ausgefuehrt"
        : h.zustand === "vorgeschlagen"
          ? "abgelehnt"
          : "rueckgaengig";

    await tx
      .update(schema.ninaHandlungen)
      .set({ zustand: neuerZustand, entschiedenAm: jetzt })
      .where(eq(schema.ninaHandlungen.id, handlungId));

    if (h.jobId) {
      await tx
        .update(schema.ninaVormerkungen)
        .set({ zustand: antwort === "behalten" ? "behalten" : "verworfen", entschiedenAm: jetzt })
        .where(
          and(
            eq(schema.ninaVormerkungen.userId, userId),
            eq(schema.ninaVormerkungen.jobId, h.jobId),
          ),
        );
    }

    /*
     * Ein verworfenes Signal wird nicht weiter verstärkt.
     *
     * Sonst entstünde beim nächsten Lauf aus denselben Ereignissen
     * dieselbe Vermutung, und die Ablehnung wäre eine Geste ohne
     * Wirkung.
     */
    if (antwort === "verworfen" && h.jobId) {
      await tx
        .update(schema.verhaltenssignale)
        .set({ status: "rejected", aktualisiertAm: jetzt })
        .where(
          and(
            eq(schema.verhaltenssignale.userId, userId),
            eq(schema.verhaltenssignale.jobId, h.jobId),
          ),
        );
    }

    /*
     * ══════════════════════════════════════════════════════════════
     * Eine Hypothese, die beantwortet wurde
     * ══════════════════════════════════════════════════════════════
     *
     * `confirmed` heisst: Die Person hat gesagt, dass die Beobachtung
     * stimmt. Mehr nicht.
     *
     * Es ändert ausdrücklich NICHT das bestätigte Suchprofil. Dafür
     * gibt es `profil_uebernehmen` — eine eigene Handlung der Klasse
     * `propose_first` mit einer eigenen Frage.
     *
     * Der Unterschied ist der zwischen „ja, ich schaue mehr auf
     * Remote" und „ja, ändere meine Suche". Das erste ist eine
     * Auskunft über sich selbst, das zweite ein Auftrag. Sie in einem
     * Klick zusammenzufassen wäre bequem und würde eine Zustimmung
     * unterstellen, die niemand gegeben hat.
     */
    if (h.handlung === "hypothese_merken") {
      await tx
        .update(schema.verhaltenssignale)
        .set({
          status: antwort === "behalten" ? "confirmed" : "rejected",
          aktualisiertAm: jetzt,
        })
        .where(
          and(
            eq(schema.verhaltenssignale.userId, userId),
            inArray(schema.verhaltenssignale.art, ["remote_interesse", "gehalt_wichtig", "richtungswechsel"]),
            eq(schema.verhaltenssignale.status, "inferred"),
          ),
        );
    }

    /*
     * ══════════════════════════════════════════════════════════════
     * Eine weggelegte Frage kommt nicht wieder
     * ══════════════════════════════════════════════════════════════
     *
     * Die Klärungen aus der Intelligenzschicht hängen an einem
     * Schlüssel, nicht an einer Stelle. Ohne diesen Zweig bliebe die
     * Klärung `offen`, und der nächste Lauf machte daraus wieder eine
     * Gelegenheit — abgelehnt, neu gestellt, abgelehnt.
     *
     * `uebergangen`, nicht `beantwortet`: Die Person hat nichts
     * gesagt, sie wollte nur nicht. Daraus einen Beleg zu machen wäre
     * eine Aussage, die niemand getroffen hat.
     */
    if (antwort === "verworfen" && h.schluessel) {
      await tx
        .update(schema.profilKlaerungen)
        .set({ zustand: "uebergangen", entschiedenAm: jetzt })
        .where(
          and(
            eq(schema.profilKlaerungen.userId, userId),
            eq(schema.profilKlaerungen.schluessel, h.schluessel),
            eq(schema.profilKlaerungen.zustand, "offen"),
          ),
        );
    }

    return { ok: true };
  });
}

/** Eine automatische Handlungsart dauerhaft abschalten oder wieder zulassen. */
export async function automatikSchalten(
  db: Database,
  userId: string,
  handlung: string,
  erlaubt: boolean,
  jetzt = new Date(),
): Promise<string[]> {
  return withUser(db, userId, async (tx) => {
    const [e] = await tx
      .select({ abgeschaltet: schema.ninaEigeninitiative.abgeschaltet })
      .from(schema.ninaEigeninitiative)
      .where(eq(schema.ninaEigeninitiative.userId, userId))
      .limit(1);

    const menge = new Set(e?.abgeschaltet ?? []);
    if (erlaubt) menge.delete(handlung);
    else menge.add(handlung);
    const liste = [...menge];

    await tx
      .insert(schema.ninaEigeninitiative)
      .values({ userId, abgeschaltet: liste, aktualisiertAm: jetzt })
      .onConflictDoUpdate({
        target: schema.ninaEigeninitiative.userId,
        set: { abgeschaltet: liste, aktualisiertAm: jetzt },
      });

    return liste;
  });
}

/** Die Stufe der Eigeninitiative setzen. */
export async function stufeSetzen(
  db: Database,
  userId: string,
  stufe: Eigeninitiative,
  jetzt = new Date(),
): Promise<void> {
  await withUser(db, userId, (tx) =>
    tx
      .insert(schema.ninaEigeninitiative)
      .values({ userId, stufe, aktualisiertAm: jetzt })
      .onConflictDoUpdate({
        target: schema.ninaEigeninitiative.userId,
        set: { stufe, aktualisiertAm: jetzt },
      }),
  );
}

/* ═══════════════════════════════════════════════════════════════
   Was Monday zu sagen hat
   ═══════════════════════════════════════════════════════════════ */

export interface Ninanachricht {
  handlungId: string;
  handlung: string;
  text: string;
  begruendung: string;
  jobId: string | null;
  brauchtZustimmung: boolean;
  erstelltAm: Date;
}

/**
 * Die nächste ungesagte Nachricht — und sie gilt danach als gesagt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum Holen und Vermerken zusammen geschehen
 * ══════════════════════════════════════════════════════════════
 *
 * Getrennt wäre es zwei Aufrufe, und zwischen ihnen läge ein Fenster:
 * Zwei offene Tabs holen dieselbe Nachricht, beide zeigen sie, und
 * die Person liest zweimal dasselbe.
 *
 * Ein `update … returning` mit einer Unterabfrage erledigt beides in
 * einer Anweisung. Wer zuerst kommt, bekommt sie; der zweite Tab
 * bekommt nichts.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum immer nur eine
 * ══════════════════════════════════════════════════════════════
 *
 * Weil Monday eine Assistentin ist und kein Postfach. Drei Hinweise
 * gleichzeitig sind keine Aufmerksamkeit, sondern eine Liste — und
 * eine Liste liest man später, also nie.
 */
export interface Zustellumstand {
  /**
   * Ob die Person gerade beschäftigt ist — sie tippt, sie spricht,
   * oder ein anderer Dialog läuft.
   *
   * ══════════════════════════════════════════════════════════════
   * Aufschieben, nicht verlieren
   * ══════════════════════════════════════════════════════════════
   *
   * Die Nachricht wird nicht verworfen und nicht als gesagt
   * vermerkt. Sie bleibt liegen und kommt beim nächsten Abruf —
   * dann geprüft, ob sie noch aktuell ist.
   *
   * Der Unterschied ist wichtig: Wer sie jetzt wegwürfe, verlöre
   * Arbeit, die schon getan ist. Wer sie jetzt zeigte, unterbräche
   * jemanden mitten im Satz.
   */
  beschaeftigt?: boolean;
}

export async function naechsteNachricht(
  db: Database,
  userId: string,
  jetzt = new Date(),
  umstand: Zustellumstand = {},
): Promise<Ninanachricht | null> {
  /*
   * Die Prüfung steht vor der Abfrage, nicht danach.
   *
   * Nach der Abfrage wäre die Nachricht bereits als gesagt vermerkt —
   * und damit für immer verloren, obwohl niemand sie gelesen hat.
   */
  if (umstand.beschaeftigt === true) return null;

  const zeilen = (await withUser(db, userId, (tx) =>
    tx.execute(sql`
      update nina_handlungen h
         set gezeigt_am = ${jetzt}
       where h.id = (
         select k.id from nina_handlungen k
          where k.user_id = ${userId}
            and k.nachricht is not null
            and k.gezeigt_am is null
            and k.zustand in ('vorgeschlagen', 'ausgefuehrt')
            /*
             * Nichts Altes nachreichen.
             *
             * Ein Hinweis von gestern zu einer Stelle, die man längst
             * weggeklickt hat, wirkt wie ein System, das nicht
             * mitbekommt, was gerade passiert.
             */
            and k.erstellt_am > ${new Date(jetzt.getTime() - 24 * 60 * 60 * 1000)}
          order by k.erstellt_am desc
          limit 1
          for update skip locked
       )
   returning h.id, h.handlung, h.nachricht, h.begruendung, h.job_id, h.zustand, h.erstellt_am
    `),
  )) as unknown as { rows: Record<string, unknown>[] };

  const z = zeilen.rows[0];
  if (!z) return null;

  return {
    handlungId: String(z.id),
    handlung: String(z.handlung),
    text: String(z.nachricht),
    begruendung: String(z.begruendung),
    jobId: z.job_id === null ? null : String(z.job_id),
    brauchtZustimmung: z.zustand === "vorgeschlagen",
    erstelltAm: new Date(String(z.erstellt_am)),
  };
}
