import { createHash, randomBytes } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { schema, withUser, type Database } from "@paycheck/db";
import { auswaehlen, kriteriumSatz, leereLage, type Auswahlkandidat } from "@paycheck/matching";
import { fensterschluessel, naechstesFenster, type Rhythmus } from "../versandfenster.ts";
import { ersatztexte, zusammenfassungRendern, type Vorlagenposten } from "./vorlage.ts";
import { mailtexteBauen, type Prompt3 } from "./mailtext.ts";
import type { Modellrufer } from "./modell.ts";

/**
 * Aus den Treffern einer Person eine Zusammenfassung bauen.
 *
 * ══════════════════════════════════════════════════════════════
 * Eine Mail je Person, nicht je Auftrag
 * ══════════════════════════════════════════════════════════════
 *
 * Wer drei Suchen laufen hat, bekommt sonst drei fast gleiche Mails
 * um acht Uhr. Die Auswahl läuft deshalb über alle fälligen Aufträge
 * derselben Person zusammen — und die Entdoppelung ebenfalls, sonst
 * meldeten zwei Aufträge dieselbe Stelle.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Entwurf noch keine Benachrichtigung ist
 * ══════════════════════════════════════════════════════════════
 *
 * `job_benachrichtigungen` wird erst geschrieben, wenn der Anbieter
 * die Mail angenommen hat. Schriebe man beim Entwurf, hiesse ein
 * gescheiterter Versand: Die Stelle gilt als gemeldet und kommt nie
 * wieder — die Person erfährt nie davon, und niemand kann es sehen.
 */

export type Uebersprungsgrund =
  | "keine_treffer"
  | "keine_zustimmung"
  | "unterdrueckt"
  | "budget"
  | "anbieter_fehlt";

export interface Zusammenfassungsbefund {
  zusammenfassungId: string | null;
  fensterschluessel: string;
  postenzahl: number;
  uebersprungen: Uebersprungsgrund | null;
  /** Was weggefallen ist, und warum — gezählt, nicht geschätzt. */
  verworfen: Record<string, number>;
  /** Nur, wenn ein Versand vorbereitet wurde. */
  ausgangId: string | null;
}

export interface Bauoptionen {
  jetzt?: Date;
  /** Die Basis der Links in der Mail. */
  basisUrl: string;
  /** Ob überhaupt eine Mail vorbereitet werden soll. */
  mailVorbereiten?: boolean;
  /**
   * Der Modellaufruf für Betreff, Einleitung und Abschluss.
   *
   * Fehlt er, stehen die deterministischen Ersatztexte da. Die sind
   * nüchterner und stimmen — und sie sind der Normalzustand, solange
   * kein Modell eingerichtet ist.
   */
  rufer?: Modellrufer;
  /** Anweisung, Schema und Fassung von Systemprompt 3. */
  prompt?: Prompt3;
  /** Der Vorname für die Anrede. `null` heisst: ohne. */
  anrede?: string | null;
}

function gehaltstext(
  min: number | null,
  max: number | null,
  waehrung: string,
  zeitraum: string,
  angegeben: boolean,
): string | null {
  /*
   * Nichts erfinden. Eine Stelle ohne Gehaltsangabe bekommt keine
   * Zeile — kein „Gehalt auf Anfrage", das nach einer Auskunft klingt.
   */
  if (!angegeben) return null;
  const betrag = (n: number) => Math.round(n).toLocaleString("de-DE");
  const spanne = min !== null && max !== null && max > min ? `${betrag(min)} – ${betrag(max)}` : betrag((max ?? min)!);
  if (min === null && max === null) return null;
  const je = zeitraum === "month" ? "im Monat" : zeitraum === "hour" ? "pro Stunde" : "im Jahr";
  return `${spanne} ${waehrung} ${je}`;
}

/**
 * Das Basislabel — serverseitig erzeugt, nicht vom Modell behauptet.
 *
 * „Bestätigter Suchauftrag vom 4. September" gegenüber „Übernommene
 * Filter vom 4. September" ist der Unterschied zwischen einem
 * Gespräch und einem Klick. Ein Modell, das den einen Satz für den
 * anderen schreibt, erfindet ein Gespräch.
 *
 * Bei gemischter Herkunft wird das nicht mit einer Einheitsaussage
 * verdeckt — dann steht beides da.
 */
export function basisLabel(
  herkuenfte: readonly string[],
  bestaetigtAm: Date | null,
): string {
  const datum = bestaetigtAm
    ? bestaetigtAm.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const arten = new Set(herkuenfte);
  const teile: string[] = [];
  if (arten.has("chat") || arten.has("voice")) teile.push("Bestätigter Suchauftrag");
  if (arten.has("suchergebnisse")) teile.push("Übernommene Filter");
  if (arten.has("vorschlag")) teile.push("Bestätigter Vorschlag");
  if (teile.length === 0) teile.push("Bestätigter Suchauftrag");
  return datum ? `${teile.join(" und ")} vom ${datum}` : teile.join(" und ");
}

/**
 * ══════════════════════════════════════════════════════════════
 * Drei Phasen, und die mittlere ohne Transaktion
 * ══════════════════════════════════════════════════════════════
 *
 *   1. lesen und auswählen   in einer Transaktion
 *   2. Text vom Modell       OHNE Transaktion
 *   3. schreiben             in einer zweiten Transaktion
 *
 * Die erste Fassung hatte alles in einer. Das ist genau der Fehler,
 * den Abschnitt 11 benennt: keine externen Aufrufe innerhalb einer
 * langen Datenbanktransaktion. Ein Modellaufruf dauert Sekunden bis
 * zu einer Minute, und solange bliebe eine Transaktion offen — bei
 * hundert Personen hundert offene Transaktionen, die auf ein fremdes
 * Netz warten.
 *
 * Aufgefallen ist es an einer Testumgebung mit genau einer Verbindung:
 * Dort ist derselbe Aufbau kein Ressourcenproblem, sondern ein
 * Stillstand. Die Prüfungen liefen in die Zeitüberschreitung, und der
 * Grund war nicht der Test.
 *
 * ── Was zwischen Phase 1 und 3 passieren kann ─────────────────
 *
 * Ein anderer Lauf kann dasselbe Fenster belegen. Das ist abgedeckt:
 * Die Eindeutigkeit auf (Person, Fenster) lässt nur eine
 * Zusammenfassung zu, und der zweite Lauf bekommt keine Zeile zurück.
 * Die Zustandsänderung an den Treffern ist wiederholbar.
 */
export async function zusammenfassungBauen(
  db: Database,
  userId: string,
  optionen: Bauoptionen,
): Promise<Zusammenfassungsbefund> {
  const jetzt = optionen.jetzt ?? new Date();

  /* ── Phase 1: lesen und auswählen ──────────────────────────── */
  const lese = await withUser(db, userId, async (tx) => {
    const auftraege = await tx
      .select()
      .from(schema.suchAuftraege)
      .where(and(eq(schema.suchAuftraege.userId, userId), eq(schema.suchAuftraege.status, "aktiv")));

    const zone = auftraege[0]?.zeitzone ?? "Europe/Berlin";
    const rhythmus = (auftraege[0]?.rhythmus ?? "taeglich") as Rhythmus;
    const schluessel = fensterschluessel(jetzt, zone, rhythmus);

    if (auftraege.length === 0)
      return {
        frueh: {
          zusammenfassungId: null,
          fensterschluessel: schluessel,
          postenzahl: 0,
          uebersprungen: "keine_zustimmung" as const,
          verworfen: {} as Record<string, number>,
          ausgangId: null,
        },
      };

    const auftragIds = auftraege.map((a) => a.id);

    /*
     * Nur empfohlene Treffer, die noch nicht ausgewählt wurden.
     *
     * `zustand = 'offen'` heisst nicht „neu berechnet", sondern „noch
     * nicht vergeben". Ein Treffer, der in einem früheren Fenster
     * nicht ausgewählt wurde, bleibt hier stehen und verschwindet
     * nicht am Versandstichtag.
     */
    const treffer = await tx
      .select({
        id: schema.auftragTreffer.id,
        auftragId: schema.auftragTreffer.auftragId,
        jobId: schema.auftragTreffer.jobId,
        kanonischeJobId: schema.auftragTreffer.kanonischeJobId,
        fitScore: schema.auftragTreffer.fitScore,
        materielleFassung: schema.auftragTreffer.materielleFassung,
        berechnetAm: schema.auftragTreffer.berechnetAm,
        gruende: schema.auftragTreffer.gruende,
        caveat: schema.auftragTreffer.caveat,
        titel: schema.jobs.title,
        ort: schema.jobs.location,
        companyId: schema.jobs.companyId,
        arbeitgeber: schema.companies.name,
        gehaltMin: schema.jobs.salaryMin,
        gehaltMax: schema.jobs.salaryMax,
        gehaltWaehrung: schema.jobs.salaryCurrency,
        gehaltZeitraum: schema.jobs.salaryPeriod,
        gehaltAngegeben: schema.jobs.salaryDisclosed,
        laeuftAb: schema.jobs.expiresAt,
      })
      .from(schema.auftragTreffer)
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.auftragTreffer.jobId))
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(
        and(
          inArray(schema.auftragTreffer.auftragId, auftragIds),
          eq(schema.auftragTreffer.zustand, "offen"),
          eq(schema.auftragTreffer.empfehlungsstatus, "empfohlen"),
        ),
      );

    /* Die Lage: Was kennt die Person schon, was hat sie abgelehnt. */
    const lage = leereLage();
    const [gemeldet, gespeichert, rueckmeldungen] = await Promise.all([
      tx
        .select()
        .from(schema.jobBenachrichtigungen)
        .where(eq(schema.jobBenachrichtigungen.userId, userId)),
      tx.select({ jobId: schema.savedJobs.jobId }).from(schema.savedJobs).where(eq(schema.savedJobs.userId, userId)),
      tx
        .select({ jobId: schema.matchFeedback.jobId, art: schema.matchFeedback.art })
        .from(schema.matchFeedback)
        .where(eq(schema.matchFeedback.userId, userId)),
    ]);
    for (const g of gemeldet) lage.bereitsGemeldet.set(g.kanonischeJobId, g.materielleFassung);
    for (const s of gespeichert) lage.gespeichert.add(s.jobId);
    for (const r of rueckmeldungen) {
      if (r.jobId === null) continue;
      if (r.art === "abgelehnt") lage.abgelehnt.add(r.jobId);
      if (r.art === "beworben") lage.beworben.add(r.jobId);
    }
    for (const t of treffer) {
      if (t.laeuftAb !== null && t.laeuftAb.getTime() < jetzt.getTime())
        lage.geschlossen.add(t.kanonischeJobId);
    }

    const kandidaten: Auswahlkandidat[] = treffer.map((t) => ({
      trefferId: t.id,
      jobId: t.jobId,
      kanonischeJobId: t.kanonischeJobId,
      arbeitgeberId: t.companyId,
      auftragId: t.auftragId,
      fitScore: t.fitScore,
      materielleFassung: t.materielleFassung,
      berechnetAm: t.berechnetAm,
      grund: (t.gruende as string[])[0] ?? null,
      caveat: t.caveat,
    }));

    const auswahl = auswaehlen(kandidaten, lage);

    /*
     * Keine Empfehlung, keine Mail.
     *
     * Der Zustand wird trotzdem festgehalten. Ein Fenster ohne
     * Treffer ist ein Ergebnis, kein fehlender Lauf — und ohne diese
     * Zeile liesse sich nicht unterscheiden, ob nichts passte oder ob
     * der Worker gar nicht lief.
     */
    if (auswahl.posten.length === 0) {
      const [leer] = await tx
        .insert(schema.zusammenfassungen)
        .values({
          userId,
          fensterschluessel: schluessel,
          fensterBeginn: jetzt,
          zustand: "uebersprungen",
          uebersprungenGrund: "keine_treffer",
        })
        .onConflictDoNothing({
          target: [schema.zusammenfassungen.userId, schema.zusammenfassungen.fensterschluessel],
        })
        .returning({ id: schema.zusammenfassungen.id });
      return {
        frueh: {
          zusammenfassungId: leer?.id ?? null,
          fensterschluessel: schluessel,
          postenzahl: 0,
          uebersprungen: "keine_treffer" as const,
          verworfen: auswahl.verworfen,
          ausgangId: null,
        },
      };
    }

    const nachId = new Map(treffer.map((t) => [t.id, t]));
    const auftragNachId = new Map(auftraege.map((a) => [a.id, a]));
    const label = basisLabel(
      auswahl.posten.map((p) => auftragNachId.get(p.auftragId)?.herkunft ?? "chat"),
      auftraege.map((a) => a.bestaetigtAm).filter((d): d is Date => d !== null).sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
    );

    const ersatz = ersatztexte(auswahl.posten.length, auftraege[0]!.name);

    /*
     * Der Modelltext wird gebaut, bevor die Zeile geschrieben wird.
     *
     * Andersherum stünde bei einem Fehlschlag eine Zusammenfassung mit
     * Ersatztexten in der Datenbank, und der nächste Lauf fände das
     * Fenster belegt — die Person bekäme dauerhaft die nüchterne
     * Fassung, ohne dass jemand den Grund sieht.
     */
    /*
     * Der Vorname, wenn es einen gibt.
     *
     * `display_name` kann ein voller Name sein, ein Spitzname oder
     * leer. Das erste Wort ist die beste verfügbare Annäherung — und
     * wo nichts steht, steht „Hallo," ohne Namen. Einen Namen zu
     * erfinden oder aus der Adresse abzuleiten wäre die Art
     * Vertraulichkeit, die auffällt, weil sie nicht stimmt.
     */
    const [person] = await tx
      .select({ name: schema.users.displayName })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    const vorname =
      optionen.anrede ?? (person?.name?.trim().split(/\s+/)[0] || null);

    /*
     * Die bestätigten Kriterien der laufenden Aufträge.
     *
     * Nur bestätigte: Ein übernommener Filter ist eine Handlung, keine
     * Aussage, und in der Mail als „dein Wunsch" zu erscheinen wäre
     * eine Behauptung über etwas, das niemand gesagt hat.
     */
    const profilIds = auftraege
      .map((a) => a.aktiveProfilVersion)
      .filter((id): id is string => id !== null);
    const wuensche =
      profilIds.length === 0
        ? []
        : (
            await tx
              .select({
                kriterium: schema.suchKriterien.kriterium,
                wert: schema.suchKriterien.wert,
              })
              .from(schema.suchKriterien)
              .where(
                and(
                  inArray(schema.suchKriterien.profilId, profilIds),
                  eq(schema.suchKriterien.bestaetigungsstatus, "bestaetigt"),
                ),
              )
          ).map(kriteriumSatz);

    return { auftraege, treffer, nachId, auswahl, label, ersatz, vorname, wuensche, schluessel };
  });

  if ("frueh" in lese && lese.frueh) return lese.frueh;
  const { auftraege, treffer, nachId, auswahl, label, ersatz, vorname, wuensche, schluessel } =
    lese as Exclude<typeof lese, { frueh: unknown }>;

  /* ── Phase 2: der Text — ausserhalb jeder Transaktion ──────── */
  const texte = await mailtexteBauen(db, {
    userId,
    auftragsname: auftraege[0]!.name,
    posten: auswahl.posten,
    titelJeId: new Map(treffer.map((t) => [t.jobId, t.titel])),
    basisLabel: label,
    anrede: vorname,
    wuensche,
    ersatz,
    rufer: optionen.rufer,
    prompt: optionen.prompt,
  });

  /* ── Phase 3: schreiben ───────────────────────────────────── */
  return withUser(db, userId, async (tx) => {
    const [zusammenfassung] = await tx
      .insert(schema.zusammenfassungen)
      .values({
        userId,
        fensterschluessel: schluessel,
        fensterBeginn: jetzt,
        zustand: "freigegeben",
        basisLabel: label,
        betreff: texte.betreff,
        einleitung: texte.einleitung,
        abschluss: texte.abschluss,
        textFassung: texte.fassung,
        modell: texte.modell,
        freigegebenAm: jetzt,
      })
      .onConflictDoNothing({
        target: [schema.zusammenfassungen.userId, schema.zusammenfassungen.fensterschluessel],
      })
      .returning({ id: schema.zusammenfassungen.id });

    /*
     * Ohne Zeile gab es dieses Fenster schon.
     *
     * Das ist der Cron, der zweimal lief. Kein Fehler — es ist die
     * Eindeutigkeit, die genau dafür da ist.
     */
    if (!zusammenfassung) {
      return {
        zusammenfassungId: null,
        fensterschluessel: schluessel,
        postenzahl: 0,
        uebersprungen: null,
        verworfen: { fenster_schon_vergeben: 1 },
        ausgangId: null,
      };
    }

    await tx.insert(schema.zusammenfassungPosten).values(
      auswahl.posten.map((p) => ({
        zusammenfassungId: zusammenfassung.id,
        userId,
        trefferId: p.trefferId,
        jobId: p.jobId,
        kanonischeJobId: p.kanonischeJobId,
        materielleFassung: p.materielleFassung,
        grund: p.grund,
        caveat: p.caveat,
        art: p.art,
        position: p.position,
      })),
    );

    /* Ausgewählt, nicht benachrichtigt — das kommt erst bei Annahme. */
    await tx
      .update(schema.auftragTreffer)
      .set({ zustand: "ausgewaehlt" })
      .where(inArray(schema.auftragTreffer.id, auswahl.posten.map((p) => p.trefferId)));

    let ausgangId: string | null = null;
    if (optionen.mailVorbereiten) {
      const vorlagenposten: Vorlagenposten[] = auswahl.posten.map((p) => {
        const t = nachId.get(p.trefferId)!;
        return {
          jobId: p.jobId,
          titel: t.titel,
          arbeitgeber: t.arbeitgeber,
          ort: t.ort,
          gehalt: gehaltstext(
            t.gehaltMin,
            t.gehaltMax,
            t.gehaltWaehrung,
            t.gehaltZeitraum,
            t.gehaltAngegeben,
          ),
          fitScore: t.fitScore,
          grund: texte.gruende.get(p.jobId) ?? p.grund ?? "",
          caveat: texte.caveats.get(p.jobId) ?? p.caveat,
          art: p.art,
          url: `${optionen.basisUrl}/app/jobs?job=${p.jobId}`,
        };
      });

      const { token, hash } = abmeldeTokenErzeugen();
      const abmeldeUrl = `${optionen.basisUrl}/abmelden?t=${token}`;
      await tx.insert(schema.abmeldeToken).values({
        userId,
        tokenHash: hash,
        zweck: "abmelden",
        /* Neunzig Tage: lange genug, dass eine alte Mail noch
           funktioniert, kurz genug, dass ein Token nicht ewig gilt. */
        gueltigBis: new Date(jetzt.getTime() + 90 * 86_400_000),
      });

      const mail = zusammenfassungRendern({
        anrede: vorname,
        betreff: texte.betreff,
        einleitung: texte.einleitung,
        abschluss: texte.abschluss,
        basisLabel: label,
        posten: vorlagenposten,
        einstellungenUrl: `${optionen.basisUrl}/app/suchauftraege`,
        abmeldeUrl,
        absenderName: "Monday von Velvova",
      });

      const [einstellung] = await tx
        .select()
        .from(schema.benachrichtigungEinstellungen)
        .where(eq(schema.benachrichtigungEinstellungen.userId, userId))
        .limit(1);

      if (einstellung?.emailAktiv && einstellung.adresseBestaetigtAm && einstellung.emailAdresse) {
        const [ausgang] = await tx
          .insert(schema.mailAusgang)
          .values({
            userId,
            zusammenfassungId: zusammenfassung.id,
            /*
             * Der Schlüssel hängt an der Zusammenfassung, nicht an der
             * Uhrzeit. Ein Retry benutzt denselben — ein neuer wäre
             * eine zweite Mail mit anderem Namen.
             */
            idempotenzSchluessel: `digest:${zusammenfassung.id}`,
            an: einstellung.emailAdresse,
            betreff: mail.betreff,
            html: mail.html,
            text: mail.text,
            abmeldeUrl,
            zustand: "queued",
          })
          .onConflictDoNothing({ target: [schema.mailAusgang.idempotenzSchluessel] })
          .returning({ id: schema.mailAusgang.id });
        ausgangId = ausgang?.id ?? null;
      }
    }

    /* Die nächste Fälligkeit fortschreiben. */
    for (const a of auftraege) {
      const naechstes = naechstesFenster(
        jetzt,
        a.zeitzone,
        a.sendezeitLokal,
        a.rhythmus as Rhythmus,
        a.wochentag,
      );
      await tx
        .update(schema.suchAuftraege)
        .set({ naechsteFaelligkeit: naechstes.faelligAm, zuletztGeprueft: jetzt, aktualisiertAm: jetzt })
        .where(eq(schema.suchAuftraege.id, a.id));
    }

    return {
      zusammenfassungId: zusammenfassung.id,
      fensterschluessel: schluessel,
      postenzahl: auswahl.posten.length,
      uebersprungen: null,
      verworfen: auswahl.verworfen,
      ausgangId,
    };
  });
}

/**
 * Ein Abmeldetoken.
 *
 * Gespeichert wird nur der Hash. Wer die Datenbank liest, kann sich
 * damit nicht abmelden — und das Token erlaubt ohnehin nur diese eine
 * Sache, kein Login und keine Profilansicht.
 */
export function abmeldeTokenErzeugen(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

export function abmeldeTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
