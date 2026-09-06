import { and, desc, eq, sql } from "drizzle-orm";
import { schema, withUser, type Database } from "@paycheck/db";
import { verdichten, type Staerke } from "@paycheck/matching";
import { naechstesFenster, type Rhythmus } from "../versandfenster.ts";

/**
 * Einen Suchauftrag anlegen, bestätigen, pausieren, beenden.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum Anlegen und Aktivieren zwei Schritte sind
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Vorschlag von Nina ist ein Vorschlag. Wer nicht antwortet, hat
 * nicht zugestimmt — er hat nicht geantwortet.
 *
 * Ein System, das Schweigen als Ja liest, verschickt Mails an
 * Menschen, die nie eine wollten, und es kann hinterher nicht zeigen,
 * wann sie zugestimmt haben sollen. Der Entwurf steht deshalb da und
 * tut nichts, bis jemand ausdrücklich zustimmt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum Pause, Aussetzen und Beenden drei Dinge sind
 * ══════════════════════════════════════════════════════════════
 *
 *   „Heute Nacht nicht"  setzt genau einen Lauf aus
 *   „Pausieren"          hält den Auftrag an, ohne ihn zu löschen
 *   „E-Mails aus"        lässt die Suche laufen, ohne zu schreiben
 *   „Beenden"            schliesst ihn ab
 *
 * In einem Schalter zusammengefasst hiesse: Wer eine Nacht Ruhe will,
 * verliert seine Suche. Das ist die Art Entscheidung, die man einmal
 * trifft und nie wieder rückgängig macht, weil man nicht merkt, was
 * man verloren hat.
 */

export interface Kriteriumseingabe {
  kriterium: string;
  wert: unknown;
  einheit?: string | null;
  operator?: string;
  staerke: Staerke;
  gruppe?: string | null;
  geltungsbereich?: string;
  herkunft: string;
  signalIds?: string[];
  bestaetigungsstatus?: "bestaetigt" | "offen";
  gueltigBis?: Date | null;
}

export interface Auftragseingabe {
  userId: string;
  name: string;
  kriterien: Kriteriumseingabe[];
  laufzeit?: "einmalig" | "fortlaufend";
  endetAm?: Date | null;
  kanal?: "nur_app" | "app_und_email";
  rhythmus?: Rhythmus;
  versandbedingung?: "nur_bei_treffern" | "immer";
  sendezeitLokal?: string;
  zeitzone?: string;
  wochentag?: number | null;
  /** Für wen gesucht wird. „Für meinen Bruder" gehört hierher. */
  geltungsbereich?: Record<string, unknown>;
  herkunft?: string;
  bestaetigungstext?: string;
  rueckfrage?: string | null;
  /** Was das Modell vorgeschlagen hat, unverändert. */
  vorschlag?: Record<string, unknown>;
  promptFassung?: string;
}

export interface Auftragsbefund {
  auftragId: string;
  profilId: string;
  version: number;
}

/**
 * Anlegen — als Entwurf, der nichts tut.
 *
 * Die Profilfassung entsteht sofort mit: Ein Auftrag ohne Kriterien
 * wäre ein Name ohne Inhalt, und die Bestätigungsfrage könnte nicht
 * zeigen, wonach eigentlich gesucht werden soll.
 */
export async function auftragAnlegen(db: Database, e: Auftragseingabe): Promise<Auftragsbefund> {
  return withUser(db, e.userId, async (tx) => {
    const [auftrag] = await tx
      .insert(schema.suchAuftraege)
      .values({
        userId: e.userId,
        name: e.name.trim().slice(0, 120),
        status: "entwurf",
        laufzeit: e.laufzeit ?? "fortlaufend",
        endetAm: e.endetAm ?? null,
        kanal: e.kanal ?? "nur_app",
        rhythmus: e.rhythmus ?? "taeglich",
        versandbedingung: e.versandbedingung ?? "nur_bei_treffern",
        sendezeitLokal: e.sendezeitLokal ?? "08:00",
        zeitzone: e.zeitzone ?? "Europe/Berlin",
        wochentag: e.wochentag ?? null,
        geltungsbereich: e.geltungsbereich ?? {},
        herkunft: e.herkunft ?? "chat",
      })
      .returning({ id: schema.suchAuftraege.id });

    const auftragId = auftrag!.id;

    const [profil] = await tx
      .insert(schema.suchProfile)
      .values({
        auftragId,
        userId: e.userId,
        version: 1,
        zustand: "entwurf",
        vorschlag: e.vorschlag ?? {},
        rueckfrage: e.rueckfrage ?? null,
        bestaetigungstext: e.bestaetigungstext ?? null,
        promptFassung: e.promptFassung ?? "suchprofil-1",
      })
      .returning({ id: schema.suchProfile.id });

    const profilId = profil!.id;

    if (e.kriterien.length > 0) {
      await tx.insert(schema.suchKriterien).values(
        e.kriterien.map((k) => ({
          profilId,
          userId: e.userId,
          kriterium: k.kriterium,
          wert: k.wert as never,
          einheit: k.einheit ?? null,
          operator: k.operator ?? "gleich",
          staerke: k.staerke,
          gruppe: k.gruppe ?? null,
          geltungsbereich: k.geltungsbereich ?? "auftrag",
          herkunft: k.herkunft,
          signalIds: k.signalIds ?? [],
          bestaetigungsstatus: k.bestaetigungsstatus ?? "offen",
          gueltigBis: k.gueltigBis ?? null,
        })),
      );
    }

    return { auftragId, profilId, version: 1 };
  });
}

export type Aktivierungsbefund =
  | { ok: true; naechsteFaelligkeit: Date }
  | { ok: false; grund: "nicht_gefunden" | "kein_profil" | "keine_zustimmung" | "adresse_unbestaetigt" };

/**
 * Bestätigen und aktivieren.
 *
 * ── Warum die Mailprüfung hier steht und nicht beim Versand ───
 *
 * Beim Versand steht sie auch — dort noch einmal, unmittelbar vor der
 * Übergabe an den Anbieter. Hier steht sie, damit niemand einen
 * Auftrag „mit E-Mail" aktiviert bekommt und wochenlang glaubt, es
 * gehe etwas hinaus.
 *
 * Ohne bestätigte Adresse wird der Auftrag trotzdem aktiv — nur eben
 * als Nur-in-App-Auftrag. Die Suche ist das Wertvolle; die Mail ist
 * ein Zustellweg.
 */
export async function auftragAktivieren(
  db: Database,
  userId: string,
  auftragId: string,
  jetzt = new Date(),
): Promise<Aktivierungsbefund> {
  return withUser(db, userId, async (tx) => {
    const [auftrag] = await tx
      .select()
      .from(schema.suchAuftraege)
      .where(and(eq(schema.suchAuftraege.id, auftragId), eq(schema.suchAuftraege.userId, userId)))
      .limit(1);
    if (!auftrag) return { ok: false, grund: "nicht_gefunden" as const };

    const [profil] = await tx
      .select()
      .from(schema.suchProfile)
      .where(eq(schema.suchProfile.auftragId, auftragId))
      .orderBy(desc(schema.suchProfile.version))
      .limit(1);
    if (!profil) return { ok: false, grund: "kein_profil" as const };

    let kanal = auftrag.kanal;
    if (kanal === "app_und_email") {
      const [einstellung] = await tx
        .select()
        .from(schema.benachrichtigungEinstellungen)
        .where(eq(schema.benachrichtigungEinstellungen.userId, userId))
        .limit(1);
      const bestaetigt =
        einstellung?.emailAktiv === true && einstellung.adresseBestaetigtAm !== null;
      /*
       * Kein Ausfall, sondern ein anderer Kanal.
       *
       * Den Auftrag zu verweigern, weil die Adresse noch nicht
       * bestätigt ist, hiesse: Wer den Bestätigungslink noch nicht
       * geklickt hat, sucht auch nicht. Das ist zwei Entscheidungen
       * in einer.
       */
      if (!bestaetigt) kanal = "nur_app";
    }

    /*
     * Die vorige aktive Fassung wird ersetzt, nicht gelöscht.
     *
     * Bestehende Treffer verweisen auf sie. Ohne sie liesse sich
     * später nicht mehr sagen, mit welchen Kriterien eine Stelle
     * empfohlen wurde.
     */
    await tx
      .update(schema.suchProfile)
      .set({ zustand: "ersetzt" })
      .where(and(eq(schema.suchProfile.auftragId, auftragId), eq(schema.suchProfile.zustand, "aktiv")));

    await tx
      .update(schema.suchProfile)
      .set({ zustand: "aktiv", aktiviertAm: jetzt })
      .where(eq(schema.suchProfile.id, profil.id));

    const fenster = naechstesFenster(
      jetzt,
      auftrag.zeitzone,
      auftrag.sendezeitLokal,
      auftrag.rhythmus as Rhythmus,
      auftrag.wochentag,
    );

    await tx
      .update(schema.suchAuftraege)
      .set({
        status: "aktiv",
        kanal,
        aktiveProfilVersion: profil.id,
        bestaetigtAm: jetzt,
        aktualisierungNoetig: false,
        naechsteFaelligkeit: fenster.faelligAm,
        aktualisiertAm: jetzt,
      })
      .where(eq(schema.suchAuftraege.id, auftragId));

    return { ok: true as const, naechsteFaelligkeit: fenster.faelligAm };
  });
}

/** Anhalten, ohne zu löschen. Die Treffer bleiben im persönlichen Bereich. */
export async function auftragPausieren(db: Database, userId: string, auftragId: string): Promise<void> {
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.suchAuftraege)
      .set({ status: "pausiert", naechsteFaelligkeit: null, aktualisiertAm: new Date() })
      .where(and(eq(schema.suchAuftraege.id, auftragId), eq(schema.suchAuftraege.userId, userId))),
  );
}

export async function auftragFortsetzen(
  db: Database,
  userId: string,
  auftragId: string,
  jetzt = new Date(),
): Promise<void> {
  await withUser(db, userId, async (tx) => {
    const [a] = await tx
      .select()
      .from(schema.suchAuftraege)
      .where(and(eq(schema.suchAuftraege.id, auftragId), eq(schema.suchAuftraege.userId, userId)))
      .limit(1);
    if (!a) return;
    const fenster = naechstesFenster(jetzt, a.zeitzone, a.sendezeitLokal, a.rhythmus as Rhythmus, a.wochentag);
    await tx
      .update(schema.suchAuftraege)
      .set({ status: "aktiv", naechsteFaelligkeit: fenster.faelligAm, aktualisiertAm: jetzt })
      .where(eq(schema.suchAuftraege.id, auftragId));
  });
}

/**
 * „Heute Nacht nicht."
 *
 * Setzt genau den bezeichneten Lauf aus, indem die Fälligkeit auf das
 * übernächste Fenster gesetzt wird. Der Auftrag bleibt aktiv.
 */
export async function laufAussetzen(
  db: Database,
  userId: string,
  auftragId: string,
  jetzt = new Date(),
): Promise<Date | null> {
  return withUser(db, userId, async (tx) => {
    const [a] = await tx
      .select()
      .from(schema.suchAuftraege)
      .where(and(eq(schema.suchAuftraege.id, auftragId), eq(schema.suchAuftraege.userId, userId)))
      .limit(1);
    if (!a || a.naechsteFaelligkeit === null) return null;
    /* Vom fälligen Fenster aus weiterzählen, nicht von jetzt: Sonst
       setzte ein Aufruf kurz vor dem Versand denselben Lauf aus, den
       er schon übersprungen hätte. */
    const uebernaechstes = naechstesFenster(
      a.naechsteFaelligkeit,
      a.zeitzone,
      a.sendezeitLokal,
      a.rhythmus as Rhythmus,
      a.wochentag,
    );
    await tx
      .update(schema.suchAuftraege)
      .set({ naechsteFaelligkeit: uebernaechstes.faelligAm, aktualisiertAm: jetzt })
      .where(eq(schema.suchAuftraege.id, auftragId));
    return uebernaechstes.faelligAm;
  });
}

export async function auftragBeenden(
  db: Database,
  userId: string,
  auftragId: string,
  grund: "nutzer" | "endzeit" | "konto_geloescht" | "fehlende_zustimmung" = "nutzer",
  jetzt = new Date(),
): Promise<void> {
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.suchAuftraege)
      .set({
        status: "beendet",
        beendetAm: jetzt,
        abschlussgrund: grund,
        naechsteFaelligkeit: null,
        aktualisiertAm: jetzt,
      })
      .where(and(eq(schema.suchAuftraege.id, auftragId), eq(schema.suchAuftraege.userId, userId))),
  );
}

/**
 * Ein Signal festhalten.
 *
 * Idempotent über den Ereignisschlüssel: Dieselbe Nachricht darf nicht
 * zweimal zu einem Signal werden, wenn der Browser die Aktion
 * wiederholt oder ein Worker neu startet.
 */
export async function signalFesthalten(
  db: Database,
  userId: string,
  signal: {
    ereignisSchluessel: string;
    art: string;
    quelle: string;
    inhalt?: Record<string, unknown>;
    auftragId?: string | null;
    nachrichtId?: string | null;
    ausdruecklich?: boolean;
    /** Verhaltenssignale verfallen; ausdrückliche Aussagen nicht. */
    verfaelltAm?: Date | null;
  },
): Promise<boolean> {
  return withUser(db, userId, async (tx) => {
    const zeilen = await tx
      .insert(schema.profilSignale)
      .values({
        userId,
        auftragId: signal.auftragId ?? null,
        ereignisSchluessel: signal.ereignisSchluessel,
        art: signal.art,
        quelle: signal.quelle,
        inhalt: signal.inhalt ?? {},
        nachrichtId: signal.nachrichtId ?? null,
        ausdruecklich: signal.ausdruecklich ?? false,
        verfaelltAm: signal.verfaelltAm ?? null,
      })
      .onConflictDoNothing({
        target: [schema.profilSignale.userId, schema.profilSignale.ereignisSchluessel],
      })
      .returning({ id: schema.profilSignale.id });

    if (zeilen.length === 0) return false;

    /*
     * Betroffene Aufträge als aktualisierungsbedürftig markieren.
     *
     * Nicht das Profil neu rechnen — das kostet einen Modellaufruf und
     * gehört in den Hintergrund. Hier wird nur vermerkt, dass es etwas
     * zu tun gibt; der Nachhollauf findet es über den Index.
     */
    if (signal.auftragId) {
      await tx
        .update(schema.suchAuftraege)
        .set({ aktualisierungNoetig: true })
        .where(eq(schema.suchAuftraege.id, signal.auftragId));
    } else {
      await tx
        .update(schema.suchAuftraege)
        .set({ aktualisierungNoetig: true })
        .where(and(eq(schema.suchAuftraege.userId, userId), eq(schema.suchAuftraege.status, "aktiv")));
    }
    return true;
  });
}

/** Die Aufträge, deren Versandfenster fällig ist. */
export async function faelligeAuftraege(
  db: Database,
  jetzt: Date,
  grenze = 200,
): Promise<{ id: string; userId: string }[]> {
  const { withSystem } = await import("@paycheck/db");
  return withSystem(db, async (tx) => {
    /* Der generische Treibertyp kennt die Zeilenform nicht. Sie steht
       direkt über der Abfrage, ist also belegt und nicht geraten. */
    const zeilen = (await tx.execute(sql`
      select id, user_id as "userId"
      from such_auftraege
      where status = 'aktiv'
        and naechste_faelligkeit is not null
        and naechste_faelligkeit <= ${jetzt.toISOString()}
      order by naechste_faelligkeit asc
      limit ${grenze}`)) as unknown as { rows: { id: string; userId: string }[] };
    return zeilen.rows;
  });
}

/* ═══════════════════════════════════════════════════════════════
   Eine Änderung als Entwurf
   ═══════════════════════════════════════════════════════════════ */

export interface Aenderungswunsch {
  kriterium: string;
  wert: unknown;
  einheit?: string | null;
  operator?: string;
  staerke: Staerke;
  gruppe?: string | null;
  /** Der Satz der Person, auf den sich die Änderung stützt. */
  aussage: string;
  /** chat · voice */
  quelle: string;
}

export interface Aenderungsbefund {
  ok: boolean;
  profilId?: string;
  version?: number;
  /** Der Satz, der zur Bestätigung angezeigt wird. */
  bestaetigungstext?: string;
  /** Was ungeklärt bleibt, weil es einer bestätigten Angabe widerspricht. */
  rueckfragen?: string[];
  grund?: "nicht_gefunden" | "kein_profil";
}

/**
 * „Nur noch Teilzeit."
 *
 * ══════════════════════════════════════════════════════════════
 * Warum daraus ein Entwurf wird und keine Änderung
 * ══════════════════════════════════════════════════════════════
 *
 * Weil eine gesprochene Zeile mehrdeutig ist. „Nur noch Teilzeit"
 * kann heissen: ab jetzt immer, oder für diesen einen Auftrag, oder
 * für heute. Und weil sich später jemand fragen wird, wann die Person
 * dem zugestimmt hat.
 *
 * Der Entwurf zeigt, was gälte. Erst `auftragAktivieren` macht ihn
 * wirksam — dieselbe Funktion, die auch die Karte benutzt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die bestehenden Kriterien mitkommen
 * ══════════════════════════════════════════════════════════════
 *
 * Eine neue Fassung ersetzt die alte vollständig. Nur das geänderte
 * Kriterium hineinzuschreiben hiesse: Wer „nur noch Teilzeit" sagt,
 * verliert seinen Ort, sein Mindestgehalt und seine Ausschlüsse.
 */
export async function auftragEntwurfAendern(
  db: Database,
  userId: string,
  auftragId: string,
  wunsch: Aenderungswunsch,
  jetzt = new Date(),
): Promise<Aenderungsbefund> {
  return withUser(db, userId, async (tx) => {
    const [auftrag] = await tx
      .select()
      .from(schema.suchAuftraege)
      .where(and(eq(schema.suchAuftraege.id, auftragId), eq(schema.suchAuftraege.userId, userId)))
      .limit(1);
    if (!auftrag) return { ok: false, grund: "nicht_gefunden" as const };

    const [aktuell] = await tx
      .select()
      .from(schema.suchProfile)
      .where(eq(schema.suchProfile.auftragId, auftragId))
      .orderBy(desc(schema.suchProfile.version))
      .limit(1);
    if (!aktuell) return { ok: false, grund: "kein_profil" as const };

    const bestand = await tx
      .select()
      .from(schema.suchKriterien)
      .where(eq(schema.suchKriterien.profilId, aktuell.id));

    /*
     * Das Signal zuerst.
     *
     * Der Compiler verlangt für jede Änderung eine Signal-ID, die
     * wirklich existiert — ohne sie gäbe es später keine Antwort auf
     * „woher weisst du das".
     */
    const schluessel = `auftrag-aendern:${auftragId}:${wunsch.kriterium}:${jetzt.getTime()}`;
    const [signal] = await tx
      .insert(schema.profilSignale)
      .values({
        userId,
        auftragId,
        ereignisSchluessel: schluessel,
        art: "auftrag_geaendert",
        quelle: wunsch.quelle,
        inhalt: { aussage: wunsch.aussage.slice(0, 2000) },
        /* Gesagt, nicht beobachtet. */
        ausdruecklich: true,
      })
      .onConflictDoNothing({
        target: [schema.profilSignale.userId, schema.profilSignale.ereignisSchluessel],
      })
      .returning({ id: schema.profilSignale.id });
    if (!signal) return { ok: false, grund: "nicht_gefunden" as const };

    const verdichtung = verdichten(
      bestand.map((k) => ({
        kriterium: k.kriterium,
        wert: k.wert,
        einheit: k.einheit,
        operator: k.operator as never,
        staerke: k.staerke as Staerke,
        gruppe: k.gruppe,
        geltungsbereich: k.geltungsbereich as never,
        herkunft: k.herkunft as never,
        bestaetigungsstatus: k.bestaetigungsstatus as never,
        bestaetigtAm: k.bestaetigtAm,
        gueltigBis: k.gueltigBis,
        signalIds: k.signalIds,
      })),
      [
        {
          kriterium: wunsch.kriterium,
          wert: wunsch.wert,
          einheit: wunsch.einheit ?? null,
          operator: (wunsch.operator ?? "gleich") as never,
          staerke: wunsch.staerke,
          gruppe: wunsch.gruppe ?? null,
          geltungsbereich: "auftrag",
          herkunft: "nutzer_aussage",
          signalIds: [signal.id],
          /* Ausdrücklicher Änderungsauftrag: Er darf eine bestätigte
             Angabe ersetzen. Alles andere würde zur Rückfrage. */
          aenderungsauftrag: true,
        },
      ],
      [
        {
          id: signal.id,
          ausdruecklich: true,
          quelle: wunsch.quelle,
          art: "auftrag_geaendert",
          beobachtetAm: jetzt,
        },
      ],
      jetzt,
    );

    const version = aktuell.version + 1;
    const [entwurf] = await tx
      .insert(schema.suchProfile)
      .values({
        auftragId,
        userId,
        version,
        zustand: "entwurf",
        vorschlag: { aussage: wunsch.aussage.slice(0, 2000), kriterium: wunsch.kriterium },
        konflikte: verdichtung.rueckfragen,
        offenePunkte: verdichtung.verworfen,
        rueckfrage:
          verdichtung.rueckfragen.length > 0
            ? `Das widerspricht ${verdichtung.rueckfragen.map((r) => r.kriterium).join(", ")}. Was gilt?`
            : null,
        bestaetigungstext: null,
        promptFassung: "direkt-1",
      })
      .returning({ id: schema.suchProfile.id });

    const profilId = entwurf!.id;
    if (verdichtung.kriterien.length > 0) {
      await tx.insert(schema.suchKriterien).values(
        verdichtung.kriterien.map((k) => ({
          profilId,
          userId,
          kriterium: k.kriterium,
          wert: k.wert as never,
          einheit: k.einheit,
          operator: k.operator,
          staerke: k.staerke,
          gruppe: k.gruppe,
          geltungsbereich: k.geltungsbereich,
          herkunft: k.herkunft,
          signalIds: k.signalIds,
          bestaetigungsstatus: k.bestaetigungsstatus,
          bestaetigtAm: k.bestaetigtAm,
          gueltigBis: k.gueltigBis,
        })),
      );
    }

    await tx
      .update(schema.suchAuftraege)
      .set({ aktualisierungNoetig: true, aktualisiertAm: jetzt })
      .where(eq(schema.suchAuftraege.id, auftragId));

    return {
      ok: true,
      profilId,
      version,
      bestaetigungstext: aenderungssatz(auftrag.name, wunsch, verdichtung.kriterien.length),
      rueckfragen: verdichtung.rueckfragen.map((r) => r.kriterium),
    };
  });
}

function aenderungssatz(
  auftragsname: string,
  wunsch: Aenderungswunsch,
  anzahl: number,
): string {
  const wert = Array.isArray(wunsch.wert) ? wunsch.wert.join(" oder ") : String(wunsch.wert);
  const stufe = wunsch.staerke === "muss" ? "Muss" : "Wunsch";
  return (
    `Für „${auftragsname}" würde ich ${wunsch.kriterium} auf ${wert} setzen (${stufe}). ` +
    `Deine übrigen ${anzahl - 1} Angaben bleiben, wie sie sind. Soll ich?`
  );
}
