import { and, asc, eq, getTableColumns, inArray } from "drizzle-orm";
import { schema, withSystem, withUser, type Database } from "@paycheck/db";
import { SCORING_VERSION, type Job, type JobRequirement } from "@paycheck/domain";
import {
  EMPFEHLUNG_V1,
  type CommuteEstimator,
  empfehlungBestimmen,
  gruppieren,
  kriteriumPruefen,
  belegeVerschmelzen,
  matchbelegePruefen,
  profilEinbettungstext,
  stelleBewerten,
  zulaessigkeitBestimmen,
  type Gehaltsangabe,
  type Kriteriumsergebnis,
  type Matchbelegeingabe,
  type Stellenangaben,
  type Suchkriterium,
} from "@paycheck/matching";
import { gruppensatz, passtZurGruppe, schluesselFinden } from "@paycheck/domain";
import { lageFuerBegriffe } from "../begriffsgruppen-messen.ts";
import { fassungsstand } from "../analyseschluessel.ts";
import { rowToJob } from "../stellenzeile.ts";
import { materielleFassung } from "./materiellefassung.ts";
import { profilkontextLaden } from "./profilkontext.ts";
import { KANDIDATEN_JE_RUNDE, vorauswahlBedingung } from "./vorauswahl.ts";
import {
  profilEinbettungHolen,
  semantischeKandidaten,
  SEMANTIK_POOL,
  type Einbetter,
  type Einbettungsmodell,
} from "./einbettung.ts";
import { BELEGE_JE_LAUF, mitGrenze, type Modellrufer } from "./modell.ts";

/**
 * Ein Suchauftrag arbeitet eine Runde.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Reihenfolge, und warum sie so ist
 * ══════════════════════════════════════════════════════════════
 *
 *   1. Vorauswahl in der Datenbank — zurückhaltend, mit Index
 *   2. Bewertung mit demselben Matchingservice wie die Liste
 *   3. Kriterienprüfung, fünf Ausgänge
 *   4. Zulässigkeit und Empfehlung, getrennt
 *   5. Schreiben, ein Treffer je Auftrag und Stelle
 *
 * Schritt 2 kommt vor Schritt 3, obwohl es umgekehrt billiger wäre:
 * Eine Stelle, die eine Muss-Bedingung verletzt, müsste man nicht
 * bewerten.
 *
 * Sie wird trotzdem bewertet, und zwar weil die Person danach fragen
 * können soll. „Warum ist die nicht dabei?" ist eine berechtigte
 * Frage, und „weil wir sie gar nicht erst angesehen haben" ist keine
 * Antwort. Der gespeicherte Treffer trägt beides: die Zahl und den
 * Grund, warum sie nicht reicht.
 *
 * ══════════════════════════════════════════════════════════════
 * Kein Modellaufruf in dieser Fassung
 * ══════════════════════════════════════════════════════════════
 *
 * Die Kriterienprüfung ist rechenbar — ob 42.000 unter 45.000 liegt,
 * ist keine Ermessensfrage. Der Modellaufruf aus Systemprompt 2 kommt
 * dort dazu, wo es tatsächlich um Sprache geht: Aufgabenähnlichkeit
 * und übertragbare Fähigkeiten. Er ist vorbereitet und ausdrücklich
 * noch nicht verdrahtet, damit die Mechanik steht, bevor jeder
 * Fehlversuch Geld kostet.
 */

export const MATCHING_FASSUNG = SCORING_VERSION;

/**
 * Der Hintergrunddienst schätzt keine Fahrtzeiten.
 *
 * Die Webschicht hat eine kleine Tabelle für Grossstadtpaare. Sie ist
 * dort als Schätzung gekennzeichnet und in einer Mail wäre sie eine
 * Behauptung: „zwölf Minuten von dir entfernt" liest sich wie eine
 * Auskunft und wäre eine Interpolation.
 *
 * Also `null`, und die Fahrtzeit bleibt ein offener Punkt, bis
 * Routendaten vorliegen.
 */
const KEINE_SCHAETZUNG: CommuteEstimator = { estimateMinutes: () => null };

export interface Auftragszeile {
  id: string;
  userId: string;
  name: string;
  status: string;
  geltungsbereich: Record<string, unknown>;
  aktiveProfilVersion: string | null;
}

export interface Laufergebnis {
  geprueft: number;
  neu: number;
  aktualisiert: number;
  empfohlen: number;
  zurueckgestellt: number;
  ausgeschlossen: number;
  /** Warum nichts gefunden wurde — nicht geschätzt, gezählt. */
  grund: string | null;
  /** Bis zu welchem Analysezeitpunkt gearbeitet wurde. */
  analyseBis: Date | null;
}

/* ═══════════════════════════════════════════════════════════════
   Kriterien laden
   ═══════════════════════════════════════════════════════════════ */

export interface Kriterienzeile extends Suchkriterium {
  bestaetigungsstatus: string;
  gueltigBis: Date | null;
  herkunft: string;
}

export async function aktiveKriterienLaden(
  db: Database,
  userId: string,
  profilId: string,
  jetzt: Date,
): Promise<Kriterienzeile[]> {
  const zeilen = await withUser(db, userId, (tx) =>
    tx.select().from(schema.suchKriterien).where(eq(schema.suchKriterien.profilId, profilId)),
  );
  return zeilen
    .filter((z) => z.bestaetigungsstatus !== "abgelehnt")
    .filter((z) => z.gueltigBis === null || z.gueltigBis.getTime() > jetzt.getTime())
    .map((z) => ({
      id: z.id,
      kriterium: z.kriterium,
      wert: z.wert,
      einheit: z.einheit,
      operator: z.operator as Suchkriterium["operator"],
      staerke: z.staerke as Suchkriterium["staerke"],
      gruppe: z.gruppe,
      bestaetigungsstatus: z.bestaetigungsstatus,
      gueltigBis: z.gueltigBis,
      herkunft: z.herkunft,
    }));
}

/* ═══════════════════════════════════════════════════════════════
   Anzeige in prüfbare Angaben übersetzen
   ═══════════════════════════════════════════════════════════════ */

interface Analysenutzlast {
  erfahrungsniveau?: string | null;
  gehaltsangaben?: {
    min: number | null;
    max: number | null;
    waehrung: string;
    zeitraum: "year" | "month" | "hour" | null;
    beleg: string;
    art: "fix" | "bedingt" | "variabel";
  }[];
}

/**
 * Die Gehaltsangaben aus Feld und Text zusammenführen.
 *
 * Getrennt gehalten, nicht verschmolzen: Das Feld des Anbieters und
 * ein „bis zu"-Satz im Fliesstext sind zwei verschiedene Aussagen,
 * und nur eine davon kann eine Untergrenze erfüllen.
 */
function gehaelterAus(job: Job, analyse: Analysenutzlast | null): {
  feld: Gehaltsangabe | null;
  weitere: Gehaltsangabe[];
} {
  const feld: Gehaltsangabe | null = job.salary.disclosed
    ? {
        min: job.salary.min,
        max: job.salary.max,
        waehrung: job.salary.currency,
        zeitraum: job.salary.period,
        /*
         * Ein Feld des Arbeitgebers gilt als zugesagt, eine
         * Plattformschätzung nicht. Der Unterschied entscheidet, ob
         * eine Untergrenze erfüllt sein kann.
         */
        garantiert: job.salary.provenance === "employer" || job.salary.provenance === "provider",
        basis: "brutto",
        herkunft: job.salary.provenance,
        beleg: job.salary.evidence,
      }
    : null;

  const weitere = (analyse?.gehaltsangaben ?? []).map((g) => ({
    min: g.min,
    max: g.max,
    waehrung: g.waehrung,
    zeitraum: g.zeitraum,
    garantiert: g.art === "fix",
    basis: null,
    herkunft: "text",
    beleg: g.beleg,
  })) satisfies Gehaltsangabe[];

  return { feld, weitere };
}

export function stellenangabenAus(
  job: Job,
  arbeitgeber: string,
  analyse: Analysenutzlast | null,
  pendelminuten: number | null,
  /* Die Anforderungen beschreiben die Rolle wie die Aufgaben. */
  anforderungen: string[] = [],
): Stellenangaben {
  const { feld, weitere } = gehaelterAus(job, analyse);
  return {
    titel: job.title,
    arbeitgeber,
    ort: job.location,
    land: job.country,
    arbeitsmodell: job.workModel,
    remoteAnteil: job.remotePercent,
    vertragsform: job.contractType,
    /*
     * Befristung als eigene Achse.
     *
     * `contract_type` kennt sieben Werte, und nur zwei sagen etwas
     * über die Befristung: `fixed_term` und `permanent`. Bei
     * `freelance`, `internship`, `temp_agency`, `apprenticeship` und
     * `working_student` heisst der Wert nicht „unbefristet" — er
     * heisst, dass die Anzeige zur Befristung nichts sagt.
     *
     * Das ist genau die Trennung, die der Auftrag verlangt:
     * „Unbefristet", „Teilzeit" und „Zeitarbeit" sind keine
     * gegenseitig ausschliessenden Werte. Wochenstunden stehen in
     * einem eigenen Feld, Zeitarbeit ist ein eigener Vertragswert.
     */
    befristet:
      job.contractType === "fixed_term" ? true : job.contractType === "permanent" ? false : null,
    wochenstunden: job.weeklyHours,
    schichtarbeit: job.shiftWork,
    reiseanteil: job.travelPercent,
    erfahrungsniveau: job.experienceLevel ?? analyse?.erfahrungsniveau ?? null,
    gehalt: feld,
    weitereGehaelter: weitere,
    aufgaben: job.coreTasks,
    anforderungen,
    wortmenge: job.descriptionTokens,
    lizenzen: job.requiredLicenses,
    sprachen: job.languageRequirements,
    pendelminuten,
    entfernungKm: null,
    breitengrad: job.latitude,
    laengengrad: job.longitude,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Gründe und offene Punkte
   ═══════════════════════════════════════════════════════════════ */

/**
 * Höchstens zwei Gründe, und nur belegte.
 *
 * Eine Liste aller erfüllten Kriterien wäre vollständig und
 * unlesbar — und sie stünde in einer Mail, die jemand am Morgen in
 * zehn Sekunden überfliegt.
 */
export function gruendeAus(ergebnisse: Kriteriumsergebnis[]): string[] {
  return ergebnisse
    .filter((e) => e.status === "erfuellt" && e.beleg !== null)
    .slice(0, 2)
    .map((e) => e.begruendung);
}

/**
 * Der wichtigste belegte offene Punkt — oder nichts.
 *
 * Ausdrücklich `null`, wenn es keinen gibt. Einen Nachteil zu
 * erfinden, damit jede Karte einen Warnsatz bekommt, macht die
 * Warnung wertlos.
 */
export function caveatAus(ergebnisse: Kriteriumsergebnis[]): string | null {
  const offen = ergebnisse.find((e) => e.status === "unbekannt" && e.fehlendesFeld !== null);
  if (offen) return offen.begruendung;
  const teilweise = ergebnisse.find((e) => e.status === "teilweise");
  return teilweise?.begruendung ?? null;
}

/* ═══════════════════════════════════════════════════════════════
   Eine Runde
   ═══════════════════════════════════════════════════════════════ */

/**
 * Die Spalten der Stellenzeile ohne Text und Wortmenge.
 *
 * Der Beschreibungstext wiegt bei dreissig Anzeigen nichts und bei
 * dreissigtausend alles. Die Prüfung liest ihn nicht — sie liest die
 * Wortmenge, und die kommt nur mit, wenn ein Kriterium sie braucht.
 */
function stellenspalten(mitWortmenge: boolean) {
  const { description, descriptionTokens, ...rest } = getTableColumns(schema.jobs);
  return mitWortmenge ? { ...rest, descriptionTokens } : rest;
}

/** Ob ein Kriterium den Fliesstext braucht. */
function brauchtWortmenge(kriterien: readonly Suchkriterium[]): boolean {
  return kriterien.some(
    (k) =>
      k.kriterium === "taetigkeit" ||
      k.kriterium === "berufsfeld" ||
      k.kriterium === "taetigkeit_ausschluss",
  );
}

export interface Laufoptionen {
  /** Wie viele Kandidaten diese Runde vertieft geprüft werden. */
  grenze?: number;
  /** Die Schwelle, ab der empfohlen wird. */
  schwelle?: number;
  jetzt?: Date;
  /**
   * Der semantische Recall-Schritt.
   *
   * Fehlt er, läuft die Suche über Struktur und Stichwort — das ist
   * kein Ausfall, sondern weniger Recall. Was er findet, geht durch
   * dieselbe vollständige Muss-Prüfung.
   */
  einbetter?: Einbetter;
  einbettungsmodell?: Einbettungsmodell;
  /** Der Modellaufruf für die Matchingbelege (Systemprompt 2). */
  rufer?: Modellrufer;
  prompt2?: Prompt2;
}

/** Anweisung, Schema und Fassung von Systemprompt 2. */
export interface Prompt2 {
  anweisung: string;
  schema: unknown;
  fassung: string;
}

export interface Laufbefund extends Laufergebnis {
  /** Wie viele Stellen der semantische Schritt zusätzlich beisteuerte. */
  semantisch: number;
  /** Wie viele Kandidaten das Modell beurteilt hat. */
  belegt: number;
}

export async function auftragslaufRunde(
  db: Database,
  auftrag: Auftragszeile,
  optionen: Laufoptionen = {},
): Promise<Laufbefund> {
  const jetzt = optionen.jetzt ?? new Date();
  const grenze = optionen.grenze ?? KANDIDATEN_JE_RUNDE;
  const leer: Laufbefund = {
    geprueft: 0, neu: 0, aktualisiert: 0, empfohlen: 0,
    zurueckgestellt: 0, ausgeschlossen: 0, grund: null, analyseBis: null,
    semantisch: 0, belegt: 0,
  };

  if (auftrag.aktiveProfilVersion === null)
    return { ...leer, grund: "kein_aktives_profil" };

  const kriterien = await aktiveKriterienLaden(db, auftrag.userId, auftrag.aktiveProfilVersion, jetzt);
  if (kriterien.length === 0) return { ...leer, grund: "keine_kriterien" };

  const profil = await profilkontextLaden(db, auftrag.userId);

  /* Der Fortschrittsstand — nicht „die letzten 24 Stunden". */
  const [fortschritt] = await withUser(db, auftrag.userId, (tx) =>
    tx
      .select()
      .from(schema.verarbeitungsFortschritt)
      .where(
        and(
          eq(schema.verarbeitungsFortschritt.auftragId, auftrag.id),
          eq(schema.verarbeitungsFortschritt.art, "matching"),
        ),
      )
      .limit(1),
  );

  /*
   * Kein Land gesagt heisst überall.
   *
   * `country` ist seit dem 7. September 2026 `null`, wenn niemand
   * etwas eingetragen hat — vorher stand dort stillschweigend „DE".
   * Eine leere Liste schränkt nicht ein; das prüft
   * `vorauswahlBedingung`.
   */
  const laender = [
    ...new Set(
      [profil.constraints.country, ...profil.constraints.targetCountries].filter(
        (l): l is string => typeof l === "string" && l.length > 0,
      ),
    ),
  ];
  const bedingung = vorauswahlBedingung(kriterien, {
    laender,
    analyseSeit: fortschritt?.analyseBis ?? null,
    analyseFassung: fassungsstand(),
  });

  const spalten = stellenspalten(brauchtWortmenge(kriterien));
  const kandidaten = [
    ...(await withSystem(db, (tx) =>
    tx
      .select({
        job: spalten,
        arbeitgeber: schema.companies.name,
        mitarbeiter: schema.companies.mitarbeiter,
        analyseId: schema.jobAnalysen.id,
        analyseFassung: schema.jobAnalysen.fassung,
        analyseExtraktion: schema.jobAnalysen.extraktion,
        analyseBeendet: schema.jobAnalysen.beendetAm,
      })
      .from(schema.jobs)
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .innerJoin(schema.jobAnalysen, eq(schema.jobAnalysen.jobId, schema.jobs.id))
      .where(bedingung)
      /*
       * Nach Analysezeit, nicht nach Veröffentlichung.
       *
       * Der Fortschrittsstand ist eine Analysezeit. Sortierte man
       * anders, liesse er sich nicht fortschreiben — und beim
       * nächsten Lauf käme dieselbe Menge wieder.
       */
      .orderBy(asc(schema.jobAnalysen.beendetAm), asc(schema.jobs.id))
      .limit(grenze),
  )),
  ];

  /*
   * ── Der semantische Recall-Schritt ────────────────────────
   *
   * Bis hierher fand die Suche über Struktur und Stichwort. Wer
   * „Lagerhelfer" gesagt hat, bekommt keine Stelle, die
   * „Kommissionierer" heisst — obwohl es dieselbe Arbeit ist.
   *
   * Dieser Schritt sucht ein zweites Mal, mit denselben harten
   * Strukturbedingungen und OHNE das Stichwort, und nimmt die
   * ähnlichsten dazu. Was er findet, geht durch dieselbe vollständige
   * Muss-Prüfung wie alles andere: Eine hohe Ähnlichkeit erfüllt
   * keine Bedingung, hebt keine auf und erhöht keinen Fit.
   */
  const semantisch = await semantischeErgaenzung(db, {
    kriterien,
    profil,
    laender,
    analyseSeit: fortschritt?.analyseBis ?? null,
    schonGefunden: new Set(kandidaten.map((k) => (k.job as { id: string }).id)),
    grenze: Math.max(0, grenze - kandidaten.length),
    spalten,
    einbetter: optionen.einbetter,
    modell: optionen.einbettungsmodell,
    userId: auftrag.userId,
    auftragId: auftrag.id,
  });
  kandidaten.push(...(semantisch.kandidaten as typeof kandidaten));

  if (kandidaten.length === 0) return { ...leer, grund: "keine_kandidaten" };

  /*
   * ── Die Anforderungen gehören dazu ────────────────────────
   *
   * Ohne sie hat `computeFit` keine belegten Fähigkeiten zu
   * vergleichen: die Abdeckung ist 0, der Fit ist `null`, und es wird
   * nie etwas empfohlen.
   *
   * Das ist genau der Unterschied, der beim ersten Lauf gemessen
   * wurde — die Stellenliste lädt sie, der Hintergrunddienst zunächst
   * nicht. Zwei Zahlen für dieselbe Stelle wären dabei
   * herausgekommen, und die Person hätte in der Liste 74 gesehen und
   * in der Mail nichts.
   *
   * Ein Abruf für alle Kandidaten. Je Stelle einzeln zu fragen wäre
   * bei dreissig Anzeigen dreissig Rundwege.
   */
  const jobIds = kandidaten.map((k) => (k.job as { id: string }).id);
  const firmenIds = [...new Set(kandidaten.map((k) => (k.job as { companyId: string }).companyId))];
  const [anforderungszeilen, bewertungszeilen, themenzeilen] = await withSystem(db, (tx) =>
    Promise.all([
      tx.select().from(schema.jobRequirements).where(inArray(schema.jobRequirements.jobId, jobIds)),
      tx.select().from(schema.reviewAggregates).where(inArray(schema.reviewAggregates.companyId, firmenIds)),
      tx.select().from(schema.reviewThemes).where(inArray(schema.reviewThemes.companyId, firmenIds)),
    ]),
  );

  /* Einmal ordnen statt bei jeder Stelle neu suchen. */
  const anforderungenJeJob = new Map<string, (typeof anforderungszeilen)[number][]>();
  for (const r of anforderungszeilen) {
    const liste = anforderungenJeJob.get(r.jobId);
    if (liste) liste.push(r);
    else anforderungenJeJob.set(r.jobId, [r]);
  }
  const bewertungenJeFirma = new Map<string, (typeof bewertungszeilen)[number][]>();
  for (const r of bewertungszeilen) {
    const liste = bewertungenJeFirma.get(r.companyId);
    if (liste) liste.push(r);
    else bewertungenJeFirma.set(r.companyId, [r]);
  }
  const themenJeFirma = new Map<string, (typeof themenzeilen)[number][]>();
  for (const t of themenzeilen) {
    const liste = themenJeFirma.get(t.companyId);
    if (liste) liste.push(t);
    else themenJeFirma.set(t.companyId, [t]);
  }

  const ergebnis: Laufbefund = {
    ...leer,
    geprueft: kandidaten.length,
    semantisch: semantisch.kandidaten.length,
    belegt: 0,
  };
  let analyseBis: Date | null = fortschritt?.analyseBis ?? null;

  /*
   * ── Erst rechnen, dann fragen, dann schreiben ─────────────
   *
   * Die deterministische Prüfung läuft für alle Kandidaten. Der
   * Modellaufruf danach bekommt nur die aussichtsreichsten — und er
   * läuft ausserhalb jeder Transaktion.
   *
   * Andersherum stünde ein Netzaufruf mitten in einer Schleife über
   * dreissig Stellen, jeder mit einer offenen Transaktion daneben.
   */
  interface Vorbefund {
    k: (typeof kandidaten)[number];
    job: ReturnType<typeof rowToJob>;
    angaben: ReturnType<typeof stellenangabenAus>;
    kriterienErgebnisse: Kriteriumsergebnis[];
    bewertung: ReturnType<typeof stelleBewerten>;
    fassung: string;
    /** Die vorläufige Zulässigkeit — vor dem Modell. */
    vorlaeufig: string;
  }
  /*
   * ── Welche Berufsgruppen der Suchbegriff überhaupt trägt ──────
   *
   * Gemessen am 10.09.2026: Von sechzehn Treffern für sieben
   * Menschen, die „Lager, Logistik" gesucht hatten, kamen elf nicht
   * über den Titel herein, sondern über den Fliesstext — darunter
   * „Sachbearbeiter Debitorenbuchhaltung" und „Verkäufer auf
   * Vollzeitbasis". In jeder dieser Anzeigen steht irgendwo „unser
   * Lager".
   *
   * Die Suche im Fliesstext bleibt: „Versandmitarbeiter" ist ein
   * echter Logistikjob, dessen Titel keinen der beiden Begriffe
   * enthält, und wer die Suche auf den Titel verengt, verliert genau
   * die Stellen, die sonst niemand findet.
   *
   * Was dazukommt, ist die amtliche Berufskennung als Unterscheider.
   * Einmal je Lauf gemessen, nicht je Stelle — und wenn die Messung
   * nichts hergibt, bleibt sie folgenlos.
   */
  const suchbegriffe = [
    ...new Set(
      kriterien
        .filter((k) => k.kriterium === "taetigkeit" || k.kriterium === "berufsfeld")
        .flatMap((k) => (Array.isArray(k.wert) ? k.wert : [k.wert]))
        .filter((w): w is string => typeof w === "string" && w.trim().length >= 3)
        .map((w) => w.trim().toLowerCase()),
    ),
  ];
  const gruppenlageDesAuftrags =
    suchbegriffe.length > 0
      ? await lageFuerBegriffe(suchbegriffe)
      : { tragend: [], stichprobe: 0, belastbar: false };

  const vorbefunde: Vorbefund[] = [];

  for (const k of kandidaten) {
    const job = rowToJob(k.job as never, k.arbeitgeber);
    const angaben = stellenangabenAus(
      job,
      k.arbeitgeber,
      (k.analyseExtraktion ?? null) as never,
      /* Ohne Routendaten keine Fahrtzeit. Siehe `kriteriumPruefen`. */
      null,
      (anforderungenJeJob.get(job.id) ?? []).map((r) => r.text),
    );

    const kriterienErgebnisse = kriterien.map((kr) => kriteriumPruefen(kr, angaben));

    const bewertung = stelleBewerten({
      job,
      requirements: (anforderungenJeJob.get(job.id) ?? []).map((r) => ({
        id: r.id,
        jobId: r.jobId,
        kind: r.kind,
        text: r.text,
        skillKey: r.skillKey,
        category: r.category as JobRequirement["category"],
      })),
      source: null,
      reviews: (bewertungenJeFirma.get(job.companyId) ?? []) as never,
      themes: (themenJeFirma.get(job.companyId) ?? []) as never,
      mitarbeiter: k.mitarbeiter,
      earlierDuplicateCount: 0,
      /*
       * Der Katalog kommt hier dazu, nicht im Profilkontext.
       *
       * `profilkontextLaden` liest Daten; welcher Katalog sie deutet,
       * ist eine Entscheidung des Laufs. Stünde die Funktion im
       * Profil, käme sie über die Datenbank — und eine Funktion lässt
       * sich nicht speichern.
       */
      profil: { ...profil, schluesselFuerAnforderung: schluesselFinden },
      commute: KEINE_SCHAETZUNG,
      now: jetzt,
    });

    const fassung = materielleFassung({
      titel: job.title,
      arbeitgeber: k.arbeitgeber,
      ort: job.location,
      arbeitsmodell: job.workModel,
      vertragsform: job.contractType,
      wochenstunden: job.weeklyHours,
      gehaltMin: job.salary.min,
      gehaltMax: job.salary.max,
      gehaltWaehrung: job.salary.currency,
      gehaltZeitraum: job.salary.period,
      gehaltAngegeben: job.salary.disclosed,
    });

    /*
     * Die vorläufige Zulässigkeit — auf Gruppenebene.
     *
     * Sie entscheidet, welche Kandidaten dem Modell vorgelegt werden.
     * Auf einzelne Kriterien zu schauen wäre falsch: `arbeitsmodell`
     * steht bei „Karlsruhe oder remote" in einer ODER-Gruppe und ist
     * für eine Stelle in Karlsruhe einzeln „nicht erfüllt" — die
     * Gruppe aber erfüllt.
     *
     * Der erste Anlauf hat genau das übersehen: Kein einziger
     * Kandidat kam zum Modell, und der Grund war unsichtbar.
     */
    const vorlaeufig = zulaessigkeitBestimmen(gruppieren(kriterienErgebnisse)).zulaessigkeit;
    vorbefunde.push({ k, job, angaben, kriterienErgebnisse, bewertung, fassung, vorlaeufig });
  }

  /*
   * ── Systemprompt 2: die Belege ────────────────────────────
   *
   * Nur für die aussichtsreichsten Kandidaten, und nur für die
   * Kriterien, die Sprache brauchen. Ob 42.000 unter 45.000 liegt,
   * ist keine Ermessensfrage — dafür einen Modellaufruf zu bezahlen
   * wäre Geld für ein Ergebnis, das schon dasteht.
   */
  const belege = await matchbelegeHolen(db, {
    auftrag,
    kriterien,
    profil,
    vorbefunde: vorbefunde.map((v) => ({
      jobId: v.job.id,
      titel: v.job.title,
      arbeitgeber: v.k.arbeitgeber,
      aufgaben: v.job.coreTasks,
      anforderungen: (anforderungenJeJob.get(v.job.id) ?? []).map((r) => ({ id: r.id, text: r.text, kind: r.kind })),
      ergebnisse: v.kriterienErgebnisse,
      fit: v.bewertung.fit.score,
      vorlaeufig: v.vorlaeufig,
    })),
    rufer: optionen.rufer,
    prompt: optionen.prompt2,
    jetzt,
  });
  ergebnis.belegt = belege.beurteilt;

  for (const v of vorbefunde) {
    const { k, job, bewertung, fassung } = v;

    /*
     * Das Urteil des Codes und das des Modells zusammenführen.
     *
     * Bei allem, was rechenbar ist, gewinnt der Code. Das Modell darf
     * nur bei Tätigkeiten bewegen — und auch dort nur mit einem Beleg
     * aus der Anzeige.
     */
    const modellkriterien = belege.jeJob.get(job.id)?.criteria ?? [];
    const verschmolzen = belegeVerschmelzen(
      v.kriterienErgebnisse.map((e) => ({
        kriteriumId: e.kriteriumId,
        kriterium: e.kriterium,
        status: e.status,
      })),
      modellkriterien,
    );
    const kriterienErgebnisse: Kriteriumsergebnis[] = v.kriterienErgebnisse.map((e) => {
      const status = (verschmolzen.status.get(e.kriteriumId) ?? e.status) as Kriteriumsergebnis["status"];
      const begruendung = verschmolzen.begruendung.get(e.kriteriumId);
      return status === e.status && !begruendung
        ? e
        : { ...e, status, begruendung: begruendung ?? e.begruendung };
    });

    const gruppen = gruppieren(kriterienErgebnisse);
    const zulaessig = zulaessigkeitBestimmen(gruppen);

    /*
     * ── Übertragbare Fähigkeiten ─────────────────────────────
     *
     * Belegte Transfers dürfen als Grund erscheinen. Unbelegte
     * Vermutungen nicht — sie werden zu einer Rückfrage.
     */
    const transfers = belege.jeJob.get(job.id)?.transferable_skill_matches ?? [];
    const belegteTransfers = transfers.filter((t) => t.art !== "unverified_possible_transfer");
    const vermutungen = transfers.filter((t) => t.art === "unverified_possible_transfer");

    const empfehlung = empfehlungBestimmen(
      {
        zulaessigkeit: zulaessig.zulaessigkeit,
        fitScore: bewertung.fit.score,
        fitAbdeckung: bewertung.fit.coverage,
        blockierendeHinweise: [],
        veraltet: job.expiresAt !== null && job.expiresAt.getTime() < jetzt.getTime(),
      },
      { schwelle: optionen.schwelle ?? EMPFEHLUNG_V1.schwelle, mindestAbdeckung: EMPFEHLUNG_V1.mindestAbdeckung },
    );

    const gruende = [
      ...gruendeAus(kriterienErgebnisse),
      ...belegteTransfers.slice(0, 1).map((t) => t.reason),
    ].slice(0, 2);
    /*
     * Der Gruppenhinweis ist ein offener Punkt, kein Ausschluss.
     *
     * Berufskennungen sind zugeordnet, nicht erklärt. Eine falsche
     * Zuordnung darf niemandem eine Stelle wegnehmen — sie darf sie
     * nur nach hinten stellen und den Grund dazuschreiben, damit der
     * Mensch widersprechen kann.
     */
    const gruppenhinweis = gruppensatz(
      passtZurGruppe(job.kldb, gruppenlageDesAuftrags),
      suchbegriffe,
    );

    const offenePunkte = [
      ...zulaessig.offeneMuss,
      ...vermutungen.slice(0, 1).map((t) => `Möglicher Übergang: ${t.job_requirement} — noch nicht belegt.`),
      ...(gruppenhinweis === null ? [] : [gruppenhinweis]),
    ];

    const geschrieben = await withUser(db, auftrag.userId, async (tx) => {
      const [zeile] = await tx
        .insert(schema.auftragTreffer)
        .values({
          userId: auftrag.userId,
          auftragId: auftrag.id,
          jobId: job.id,
          /* Ohne erkannte Dublette zeigt die Stelle auf sich selbst. */
          kanonischeJobId: job.id,
          profilId: auftrag.aktiveProfilVersion!,
          analyseId: k.analyseId,
          analyseFassung: k.analyseFassung,
          matchingFassung: MATCHING_FASSUNG,
          fitScore: bewertung.fit.score,
          fitAbdeckung: bewertung.fit.coverage,
          zulaessigkeit: zulaessig.zulaessigkeit,
          empfehlungsstatus: empfehlung.status,
          empfehlungsgruende: empfehlung.gruende,
          kriterienErgebnisse,
          gruende,
          offenePunkte,
          /* Die Kette, an der der Wert hängt — mitgeschrieben, damit
             sie beim nächsten Ansehen dieselbe ist. */
          anforderungsbefunde: bewertung.fit.anforderungsbefunde,
          /*
           * ══════════════════════════════════════════════════════
           * Der Vorbehalt wird gerechnet, nicht geschrieben
           * ══════════════════════════════════════════════════════
           *
           * Die erste Fassung nahm den Vorbehalt von Systemprompt 2,
           * wenn er einen lieferte. Ein echter Lauf am 6. September
           * ergab damit bei „Versandmitarbeiter (m/w/d)", Randstad
           * Deutschland:
           *
           *   erfuellt  vertragsform  — Vertragsform „permanent".
           *   Vorbehalt: Vertragsform ist ein Muss-Kriterium
           *              und wird nicht erfüllt.
           *
           * Jede einzelne Prüfung sagte „erfüllt", und darunter stand
           * das Gegenteil. Der Satz stammt aus keiner Zeile dieses
           * Programms — das Modell hat ihn geschrieben.
           *
           * Ein Widerspruch zwischen Befund und Vorbehalt ist
           * schlimmer als ein fehlender Vorbehalt: Er lässt beide
           * unglaubwürdig aussehen, und die Person kann nicht
           * entscheiden, welchem sie glauben soll.
           *
           * Der Vorbehalt folgt aus den Kriteriumsergebnissen. Die
           * sind gerechnet, und was gerechnet ist, schreibt kein
           * Modell um — dieselbe Regel wie in `belegeVerschmelzen`.
           */
          caveat: caveatAus(kriterienErgebnisse),
          materielleFassung: fassung,
          berechnetAm: jetzt,
        })
        .onConflictDoUpdate({
          target: [schema.auftragTreffer.auftragId, schema.auftragTreffer.jobId],
          set: {
            analyseId: k.analyseId,
            analyseFassung: k.analyseFassung,
            matchingFassung: MATCHING_FASSUNG,
            fitScore: bewertung.fit.score,
            fitAbdeckung: bewertung.fit.coverage,
            zulaessigkeit: zulaessig.zulaessigkeit,
            empfehlungsstatus: empfehlung.status,
            empfehlungsgruende: empfehlung.gruende,
            kriterienErgebnisse,
            gruende,
            offenePunkte,
            /* Gerechnet, nicht vom Modell — Begründung oben. */
            caveat: caveatAus(kriterienErgebnisse),
            materielleFassung: fassung,
            berechnetAm: jetzt,
            /*
             * `zustand` wird NICHT zurückgesetzt.
             *
             * Eine bereits gemeldete Stelle bleibt gemeldet, auch wenn
             * sie neu bewertet wird. Sonst käme sie bei jeder
             * Neubewertung wieder in die Mail.
             */
          },
        })
        .returning({ id: schema.auftragTreffer.id, berechnet: schema.auftragTreffer.berechnetAm });
      return zeile;
    });

    if (geschrieben) ergebnis.neu++;
    if (empfehlung.status === "empfohlen") ergebnis.empfohlen++;
    else if (empfehlung.status === "zurueckgestellt") ergebnis.zurueckgestellt++;
    else ergebnis.ausgeschlossen++;

    if (k.analyseBeendet && (analyseBis === null || k.analyseBeendet > analyseBis)) {
      analyseBis = k.analyseBeendet;
    }
  }

  /*
   * Der Fortschritt wird erst nach der Schleife geschrieben.
   *
   * Bricht der Worker mittendrin ab, bleibt der alte Stand stehen und
   * die Runde wird wiederholt. Doppelte Arbeit ist billig; ein
   * übersprungener Block Stellen ist unsichtbar.
   */
  await withUser(db, auftrag.userId, (tx) =>
    tx
      .insert(schema.verarbeitungsFortschritt)
      .values({
        auftragId: auftrag.id,
        userId: auftrag.userId,
        art: "matching",
        analyseBis,
        letzterLauf: jetzt,
        stand: { geprueft: ergebnis.geprueft, empfohlen: ergebnis.empfohlen },
      })
      .onConflictDoUpdate({
        target: [schema.verarbeitungsFortschritt.auftragId, schema.verarbeitungsFortschritt.art],
        set: {
          analyseBis,
          letzterLauf: jetzt,
          stand: { geprueft: ergebnis.geprueft, empfohlen: ergebnis.empfohlen },
          aktualisiertAm: jetzt,
        },
      }),
  );

  ergebnis.analyseBis = analyseBis;
  if (ergebnis.empfohlen === 0) ergebnis.grund = "keine_ueber_schwelle";
  return ergebnis;
}


/* ═══════════════════════════════════════════════════════════════
   Semantischer Recall
   ═══════════════════════════════════════════════════════════════ */

interface Ergaenzungseingabe {
  kriterien: readonly Kriterienzeile[];
  profil: Awaited<ReturnType<typeof profilkontextLaden>>;
  laender: string[];
  analyseSeit: Date | null;
  schonGefunden: Set<string>;
  grenze: number;
  spalten: ReturnType<typeof stellenspalten>;
  einbetter?: Einbetter;
  modell?: Einbettungsmodell;
  userId: string;
  auftragId: string;
}

/**
 * Was die Stichwortsuche übersehen hat.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum derselbe Strukturfilter und nur das Stichwort weg
 * ══════════════════════════════════════════════════════════════
 *
 * Der Recall-Schritt soll finden, was anders heisst — nicht, was
 * anders bezahlt oder woanders liegt. Land, Gehalt und Arbeitsmodell
 * bleiben deshalb hart; nur die Wörter fallen weg.
 *
 * Ohne diese Trennung wäre Ähnlichkeit ein Weg, eine Bedingung zu
 * umgehen: Ein Job in Hamburg klingt genauso nach Lager wie einer in
 * Karlsruhe.
 */
async function semantischeErgaenzung(
  db: Database,
  e: Ergaenzungseingabe,
): Promise<{ kandidaten: unknown[]; text: string | null }> {
  if (e.grenze <= 0 || !e.modell) return { kandidaten: [], text: null };

  /*
   * Der Text der Person. Ohne ihn kein Vektor und kein Schritt —
   * und das ist kein Ausfall, sondern weniger Recall.
   */
  const text = profilEinbettungstext({
    taetigkeiten: e.kriterien
      .filter((k) => k.kriterium === "taetigkeit")
      .flatMap((k) => (Array.isArray(k.wert) ? k.wert.map(String) : [String(k.wert)])),
    berufsfelder: e.kriterien
      .filter((k) => k.kriterium === "berufsfeld")
      .flatMap((k) => (Array.isArray(k.wert) ? k.wert.map(String) : [String(k.wert)])),
    /* Nur bestätigte Fähigkeiten — eine Vermutung im Vektor ist eine
       Vermutung, der man nicht ansieht, dass sie eine ist. */
    faehigkeiten: e.profil.evidence
      .filter((b) => b.userConfirmed && !b.userRejected && b.type === "skill")
      .map((b) => b.statement),
    vorlieben: e.profil.energisingTasks,
  });

  const vektor = await profilEinbettungHolen(
    db,
    e.userId,
    e.auftragId,
    text,
    e.modell,
    e.einbetter,
  );
  if (!vektor) return { kandidaten: [], text };

  /* Derselbe Filter, nur ohne die Wörter. */
  const bedingung = vorauswahlBedingung(
    e.kriterien,
    { laender: e.laender, analyseSeit: e.analyseSeit, analyseFassung: fassungsstand() },
    { ohneBegriffe: true },
  );

  const pool = await withSystem(db, (tx) =>
    tx
      .select({ id: schema.jobs.id })
      .from(schema.jobs)
      .innerJoin(schema.jobAnalysen, eq(schema.jobAnalysen.jobId, schema.jobs.id))
      .where(bedingung)
      .orderBy(asc(schema.jobAnalysen.beendetAm), asc(schema.jobs.id))
      .limit(SEMANTIK_POOL),
  );

  const poolIds = pool.map((p) => p.id).filter((id) => !e.schonGefunden.has(id));
  if (poolIds.length === 0) return { kandidaten: [], text };

  const treffer = await semantischeKandidaten(db, vektor, e.modell, poolIds, e.grenze);
  if (treffer.length === 0) return { kandidaten: [], text };

  const kandidaten = await withSystem(db, (tx) =>
    tx
      .select({
        job: e.spalten,
        arbeitgeber: schema.companies.name,
        mitarbeiter: schema.companies.mitarbeiter,
        analyseId: schema.jobAnalysen.id,
        analyseFassung: schema.jobAnalysen.fassung,
        analyseExtraktion: schema.jobAnalysen.extraktion,
        analyseBeendet: schema.jobAnalysen.beendetAm,
      })
      .from(schema.jobs)
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .innerJoin(schema.jobAnalysen, eq(schema.jobAnalysen.jobId, schema.jobs.id))
      .where(inArray(schema.jobs.id, treffer.map((t) => t.jobId))),
  );

  return { kandidaten, text };
}

/* ═══════════════════════════════════════════════════════════════
   Systemprompt 2 — Matchingbelege
   ═══════════════════════════════════════════════════════════════ */

export interface Belegkandidat {
  jobId: string;
  titel: string;
  arbeitgeber: string;
  aufgaben: string[];
  anforderungen: { id: string; text: string; kind: string }[];
  ergebnisse: Kriteriumsergebnis[];
  fit: number | null;
  /** eligible · needs_clarification · ineligible — vor dem Modell. */
  vorlaeufig: string;
}

interface Belegeingabe {
  auftrag: Auftragszeile;
  kriterien: readonly Kriterienzeile[];
  profil: Awaited<ReturnType<typeof profilkontextLaden>>;
  vorbefunde: Belegkandidat[];
  rufer?: Modellrufer;
  prompt?: Prompt2;
  jetzt: Date;
}

export interface Belegbefund {
  jeJob: Map<string, Matchbelegeingabe>;
  beurteilt: number;
  verworfen: { kennung: string; grund: string }[];
}

/**
 * Die Belege für die aussichtsreichsten Kandidaten holen.
 *
 * ══════════════════════════════════════════════════════════════
 * Welche Kandidaten und warum nur die
 * ══════════════════════════════════════════════════════════════
 *
 * Die, bei denen keine Muss-Bedingung nachweislich verletzt ist. Eine
 * Stelle, die eine Bedingung bricht, wird nicht empfohlen — und ein
 * Modellaufruf, der das bestätigt, ist Geld für eine Zahl, die schon
 * dasteht.
 *
 * Unter diesen die mit dem höchsten Fit, höchstens `BELEGE_JE_LAUF`.
 * Die Grenze ist eine Kostenentscheidung: Ein Auftrag, der stündlich
 * läuft, würde sonst je Person und Tag Dutzende Aufrufe machen.
 *
 * ══════════════════════════════════════════════════════════════
 * Was das Modell sieht
 * ══════════════════════════════════════════════════════════════
 *
 * Die Kriterien mit dem, was der Code schon herausgefunden hat, die
 * Aufgaben und Anforderungen der Stelle mit ihren Belegkennungen, und
 * die bestätigten Aussagen der Person mit ihren.
 *
 * Nicht: der volle Anzeigentext, der Gesprächsverlauf, andere Nutzer.
 * Die Belegkennungen sind der Punkt — jede Beurteilung muss auf eine
 * zeigen, sonst wird sie hinterher heruntergestuft.
 */
async function matchbelegeHolen(db: Database, e: Belegeingabe): Promise<Belegbefund> {
  const leer: Belegbefund = { jeJob: new Map(), beurteilt: 0, verworfen: [] };
  if (!e.rufer || !e.prompt) return leer;

  /*
   * Nur Kandidaten ohne nachgewiesene Verletzung. Und nur die
   * besten davon — die Grenze ist eine Kostenentscheidung.
   */
  const aussichtsreich = e.vorbefunde
    /*
     * Auf Gruppenebene, nicht je Kriterium. Eine ODER-Gruppe mit
     * einer erfüllten Alternative ist erfüllt, auch wenn die andere
     * einzeln „nicht erfüllt" heisst.
     */
    .filter((v) => v.vorlaeufig !== "ineligible")
    .sort((a, b) => (b.fit ?? -1) - (a.fit ?? -1) || a.jobId.localeCompare(b.jobId))
    .slice(0, BELEGE_JE_LAUF);
  if (aussichtsreich.length === 0) return leer;

  /* Die bestätigten Aussagen der Person — mit ihren Kennungen. */
  const profilbelege = e.profil.evidence
    .filter((b) => b.userConfirmed && !b.userRejected)
    .slice(0, 30)
    .map((b) => ({ id: b.id, aussage: b.statement, art: b.type }));

  const eingabe = JSON.stringify({
    suchprofil: {
      kriterien: e.kriterien.map((k) => ({
        criterion_id: k.kriterium,
        wert: k.wert,
        staerke: k.staerke,
        gruppe: k.gruppe,
      })),
      belege: profilbelege,
    },
    rubrik: {
      status: ["fulfilled", "partially_fulfilled", "not_fulfilled", "unknown", "conflicting"],
      transfer: ["direct_skill_match", "transferable_skill_match", "unverified_possible_transfer"],
    },
    kandidaten: aussichtsreich.map((v) => ({
      job_id: v.jobId,
      titel: v.titel,
      arbeitgeber: v.arbeitgeber,
      aufgaben: v.aufgaben.slice(0, 12),
      /* Die Anforderungen tragen ihre Kennung — sie sind die
         Jobbelege, auf die sich jedes Urteil berufen muss. */
      anforderungen: v.anforderungen.slice(0, 15).map((a) => ({
        id: a.id,
        text: a.text,
        art: a.kind,
      })),
      /* Was der Code schon weiss. Das Modell soll es nicht neu
         erfinden, sondern dort ergänzen, wo Sprache nötig ist. */
      bereits_geprueft: v.ergebnisse.map((r) => ({
        criterion_id: r.kriterium,
        status: r.status,
        begruendung: r.begruendung,
      })),
    })),
  });

  const antwort = await mitGrenze<{ results: Matchbelegeingabe[] }>(db, {
    userId: e.auftrag.userId,
    zweck: "suchauftrag:belege",
    promptKey: "matchbelege",
    promptVersion: e.prompt.fassung,
    system: e.prompt.anweisung,
    text: eingabe,
    schema: e.prompt.schema,
    schemaName: "velvova_matchbelege",
    tier: "fast",
    rufer: e.rufer,
    lohntSich: aussichtsreich.length > 0,
  });
  if (!antwort.ok) return leer;

  const geprueft = matchbelegePruefen(antwort.data.results ?? [], {
    erlaubteJobs: new Set(aussichtsreich.map((v) => v.jobId)),
    erlaubteKriterien: new Set(e.kriterien.map((k) => k.kriterium)),
    erlaubteJobbelege: new Set(aussichtsreich.flatMap((v) => v.anforderungen.map((a) => a.id))),
    erlaubteProfilbelege: new Set(profilbelege.map((b) => b.id)),
  });

  return {
    jeJob: new Map(geprueft.gueltig.map((g) => [g.job_id, g])),
    beurteilt: geprueft.gueltig.length,
    verworfen: geprueft.verworfen,
  };
}
