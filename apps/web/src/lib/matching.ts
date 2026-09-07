import { cache } from "react";
import { erfahrungsniveauAusText, rowToJob } from "@paycheck/jobs";
import { canonicalKey } from "@paycheck/jobs/canonical";
import {
  brauchtReihenfolge,
  KANDIDATEN_REIHENFOLGE,
  kandidatenBedingung,
  type Vorauswahl,
} from "./kandidaten.ts";
import { getDb, schema, withUser, type Database } from "@paycheck/db";
import {
  UserConstraintsSchema,
  type EvidenceItem,
  type Job,
  type JobRequirement,
  type JobSource,
  type ReviewAggregate,
  type ReviewTheme,
  type UserConstraints,
} from "@paycheck/domain";
import {
  checkConstraints,
  computeAiTransition,
  computeConfidence,
  computeFit,
  computeJobQuality,
  computeListingConfidence,
  computeOverall,
  sortJobs,
  type CommuteEstimator,
  type RankableJob,
  type SortKey,
  assessScamSignals,
  type ScamAssessment,
  einstufen,
  anzeigenqualitaet,
  type Anzeigenqualitaet,
  stelleBewerten,
} from "@paycheck/matching";
import { and, eq, gt, inArray, lte, isNull, sql, getTableColumns } from "drizzle-orm";
import { ladeSitzungsbedingungen, ueberlagern } from "./nina/sitzungsbedingungen.ts";
import { harteBedingungenLaden } from "./karriere/praeferenzen.ts";
import { abgelegteStellen } from "./nina/rueckmeldung.ts";

/**
 * Bringt Datenbank und Bewertungslogik zusammen.
 *
 * Die Berechnung läuft bewusst bei jeder Anfrage neu, statt gespeicherte
 * Werte auszuliefern: ändert der Mensch eine Bedingung oder bestätigt
 * eine Evidenz, muss sich das Ergebnis sofort ändern. Persistiert werden
 * die Ergebnisse zusätzlich (Tabelle job_matches), damit ein Score später
 * nachvollziehbar bleibt - nicht als Cache.
 */

/**
 * Schätzt Reisezeiten aus einer kleinen Tabelle. Ein Routendienst wäre
 * genauer, braucht aber einen Vertrag und schickt den Wohnort an Dritte.
 * Solange keiner verbunden ist, sagt die Oberfläche "geschätzt" - und
 * unbekannte Verbindungen liefern null, nicht eine erfundene Zahl.
 */
const DISTANCE_MINUTES: Record<string, Record<string, number>> = {
  Hamburg: { Hamburg: 25, Lübeck: 70, Kiel: 85, Bremen: 75, Hannover: 100, Berlin: 110, München: 380 },
  Berlin: { Berlin: 30, Hamburg: 110, Leipzig: 75, München: 260 },
  München: { München: 30, Augsburg: 45, Nürnberg: 70, Berlin: 260, Hamburg: 380 },
  Köln: { Köln: 25, Düsseldorf: 35, Bonn: 30, Dortmund: 60 },
};

export const commuteEstimator: CommuteEstimator = {
  estimateMinutes(from, to, mode) {
    const table = DISTANCE_MINUTES[from];
    const base = table?.[to];
    if (base === undefined) return null;
    // Grobe Anpassung nach Verkehrsmittel. Bewusst konservativ.
    const factor = mode === "car" ? 0.85 : mode === "bike" ? 1.6 : mode === "walk" ? 4 : 1;
    return Math.round(base * factor);
  },
};

// --- Laden ---------------------------------------------------------------

/**
 * Die Spalten der Ranglistenabfrage: alle ausser der Beschreibung.
 *
 * Über `getTableColumns` und nicht als Handliste — sonst fehlt beim
 * nächsten neuen Feld die Spalte in der Liste, und niemand merkt es,
 * bis eine Anzeige leer bleibt. So ist Weglassen die Ausnahme, die
 * hier steht, und Mitnehmen die Regel.
 */
const { description: _beschreibungBleibtDraussen, ...JOB_SPALTEN_OHNE_TEXT } =
  getTableColumns(schema.jobs);

/**
 * Dieselben Spalten, aber ohne die Wortmenge.
 *
 * ── Warum das nötig wurde ─────────────────────────────────────
 *
 * Gemessen bei 82.654 Stellen: 111 MB je Ladevorgang, davon **82 MB
 * `description_tokens`** — drei Viertel. Die Vollladung dauerte 46,8
 * Sekunden, und sie wächst mit dem Bestand.
 *
 * ── Warum sie meistens niemand braucht ────────────────────────
 *
 * `computeFit` liest die Wortmenge an genau zwei Stellen: für den
 * Arbeitsstil und für die Werte. Beide laufen nur, wenn die Person
 * Arbeitsstil-Vorlieben oder gewichtete Werte hinterlegt hat. Wer das
 * nicht hat — und das sind alle vor dem ersten Karrieregespräch —
 * bekam 82 MB übertragen, die kein Code anfasst.
 *
 * Geholt wird sie deshalb erst, wenn ein Profil sie wirklich braucht.
 */
const { descriptionTokens: _wortmengeSpaeter, ...JOB_SPALTEN_SCHLANK } = JOB_SPALTEN_OHNE_TEXT;

type JobZeileOhneText = Omit<typeof schema.jobs.$inferSelect, "description">;
/** Wie oben, aber ohne die Wortmenge — siehe `JOB_SPALTEN_SCHLANK`. */
type JobZeileSchlank = Omit<JobZeileOhneText, "descriptionTokens">;

/*
 * Re-Export, damit bestehende Aufrufer unverändert bleiben.
 *
 * Die Funktion selbst steht in `@paycheck/jobs`. Sie musste dorthin,
 * weil der Hintergrunddienst des Suchauftrags als Skript ohne Next.js
 * läuft — und eine zweite Abbildung derselben Zeile ist genau der
 * Anfang des Problems, vor dem der Kommentar dort warnt.
 */
export { rowToJob };

function rowToEvidence(row: typeof schema.evidenceItems.$inferSelect): EvidenceItem {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    statement: row.statement,
    sourceType: row.sourceType,
    sourceRef: row.sourceRef,
    confidence: row.confidence,
    userConfirmed: row.userConfirmed,
    userRejected: row.userRejected,
    sensitivityLevel: row.sensitivityLevel,
    retentionClass: row.retentionClass,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export interface UserProfileContext {
  constraints: UserConstraints;
  evidence: EvidenceItem[];
  energisingTasks: string[];
  drainingTasks: string[];
  workStylePreferences: string[];
  rankedValues: string[];
  statedInterests: string[];
  profileConfirmed: boolean;
  coverage: number;
}

const EMPTY_CONSTRAINTS = UserConstraintsSchema.parse({
  minSalaryPerYear: null,
  baseLocation: null,
  maxCommuteMinutes: null,
  weeklyHoursMin: null,
  weeklyHoursMax: null,
  maxTravelPercent: null,
});

/*
 * Auch das Profil einmal je Anfrage.
 *
 * Die Heute-Seite lädt es selbst, der Riegel lädt es, der Trichter lädt
 * es, und `loadScoredJob` lädt es noch einmal. Viermal dieselbe
 * Transaktion für Daten, die sich innerhalb einer Anfrage nicht ändern
 * können.
 */
export const loadProfileContext = cache(async function loadProfileContext(
  userId: string,
): Promise<UserProfileContext> {
  const db = await getDb();

  /*
   * Die Sitzungsschicht wird VOR der Transaktion gelesen.
   *
   * Sie kommt aus einem Keks, nicht aus der Datenbank. Sie mitten in
   * einen Datenbankvorgang zu holen vermischt zwei Quellen, die nichts
   * miteinander zu tun haben — und hielte die Verbindung offen,
   * während auf etwas gewartet wird, das längst da ist.
   */
  const sitzung = await ladeSitzungsbedingungen();

  return withUser(db, userId, (tx) => profilkontextAusTx(tx, userId, sitzung));
});

/**
 * Derselbe Profilkontext, aber in einer bereits offenen Transaktion.
 *
 * Der Grund ist derselbe wie bei `gateAusTx`: Eine eigene
 * `withUser`-Transaktion kostet vier Netzrunden, von denen drei nur
 * Verwaltung sind. Die Stellenseite liest sechs Dinge und zahlt sie
 * jetzt einmal.
 *
 * Die Sitzungsbedingungen kommen als Argument herein und werden hier
 * NICHT gelesen — aus demselben Grund wie oben: Sie stammen aus einem
 * Keks, und eine offene Datenbankverbindung soll nicht darauf warten.
 *
 * Kein `cache()` auf dieser Fassung. React' `cache` schlüsselt über
 * die Argumente, und eine Transaktion ist bei jedem Aufruf ein
 * anderes Objekt — der Zwischenspeicher träfe nie und wüchse nur.
 * Wer zwischenspeichern will, nimmt `loadProfileContext`.
 */
export async function profilkontextAusTx(
  tx: Database,
  userId: string,
  sitzung: Awaited<ReturnType<typeof ladeSitzungsbedingungen>>,
): Promise<UserProfileContext> {
  return (async () => {
    /*
     * Drei unabhängige Abfragen gleichzeitig.
     *
     * Bedingungen, Belege und Profil hängen nicht voneinander ab — sie
     * standen nur untereinander. Jedes `await` ist gegen Supabase ein
     * eigener Netzweg von 44 Millisekunden; drei davon sind 132, für
     * Daten, die alle gleichzeitig hätten unterwegs sein können.
     */
    const [constraintRows, evidenceRows, profileRows] = await Promise.all([
      tx
        .select()
        .from(schema.userConstraints)
        .where(eq(schema.userConstraints.userId, userId))
        .limit(1),
      tx
        .select()
        .from(schema.evidenceItems)
        .where(and(eq(schema.evidenceItems.userId, userId), isNull(schema.evidenceItems.deletedAt))),
      tx
        .select()
        .from(schema.careerProfiles)
        .where(eq(schema.careerProfiles.userId, userId))
        .limit(1),
    ]);
    const constraintRow = constraintRows[0];
    const profileRow = profileRows[0];

    const evidence = evidenceRows.map(rowToEvidence);
    const alive = evidence.filter((e) => !e.userRejected);

    // Aus der Evidenz ableiten, was der Fit an Präferenzen braucht.
    const byRef = (needle: string) =>
      alive.filter((e) => e.sourceRef?.includes(needle)).map((e) => e.statement);

    const energising = alive
      .filter((e) => e.type === "preference" && /energie gibt|geben energie|leicht/i.test(e.statement))
      .map((e) => e.statement);
    const draining = alive
      .filter((e) => e.type === "preference" && /kostet|laugt|vermeide|falsch an/i.test(e.statement))
      .map((e) => e.statement);

    let constraints = EMPTY_CONSTRAINTS;
    if (constraintRow?.data) {
      const parsed = UserConstraintsSchema.safeParse(constraintRow.data);
      // Ein ungültiger Datensatz darf nicht dazu führen, dass Bedingungen
      // stillschweigend wegfallen. Lieber die leere, sichere Fassung.
      if (parsed.success) constraints = parsed.data;
    }

    /*
     * „Nur für diese Suche" liegt oben auf.
     *
     * Die Richtung ist nicht umkehrbar: Was für diese Suche gilt,
     * überschreibt für diese Suche — und nur hier, im Lesen. In
     * `user_constraints` wird nichts davon geschrieben.
     *
     * Ohne diese Zeile wäre der dritte Knopf an der Bedingungskarte
     * eine Attrappe: Er setzte den Keks, und die Jobliste läse ihn nie.
     */
    const constraintsMitSitzung = ueberlagern(constraints, sitzung);

    return {
      constraints: constraintsMitSitzung,
      evidence,
      energisingTasks: energising.length > 0 ? energising : byRef("tasks_and_energy"),
      drainingTasks: draining,
      workStylePreferences: byRef("work_style_and_environment"),
      rankedValues: byRef("values_and_motives"),
      statedInterests: byRef("learning_goals"),
      profileConfirmed: profileRow?.confirmedByUser ?? false,
      coverage: profileRow?.coverage ?? 0,
    };
  })();
}

// --- Bewerten ------------------------------------------------------------

export interface ScoredJob extends RankableJob {
  job: Job;
  /**
   * Wie transparent die ANZEIGE ist — nicht, wie gut die Stelle ist.
   *
   * Sechs gleich gewichtete Punkte: Vergütung, Aufgaben, Vertragsform,
   * Arbeitszeit, Arbeitsort, Bewerbungsweg. Fehlende Angaben zählen
   * hier als fehlende Transparenz, nicht als schlechte Bedingungen.
   */
  anzeige: Anzeigenqualitaet;
  /**
   * Die Sprache, in der die Anzeige geschrieben ist.
   *
   * Nur bei der Einzelabfrage gesetzt — in der Liste wird nichts
   * übersetzt, dort stehen nur Titel und Ort. `null` heisst „nicht
   * geprüft"; übersetzt wird nur bei einer sicher erkannten fremden
   * Sprache.
   */
  originalLanguage?: string | null;
  requirements: JobRequirement[];
  source: JobSource | null;
  /**
   * Was wir über den Arbeitgeber wissen — aus der Anreicherung.
   *
   * Alles `null`, solange die Firma nicht angereichert wurde, und das
   * ist der Normalfall: 186 von 135.956 Firmen haben eine Branche.
   * Die Oberfläche zeigt deshalb nichts an, wo nichts steht — kein
   * Platzhalter, keine Vermutung.
   */
  firma: { mitarbeiter: string | null; branche: string | null; hauptsitz: string | null };
  /**
   * Warnzeichen in der Anzeige selbst.
   *
   * Steht getrennt von allen anderen Werten, weil es um etwas anderes
   * geht: nicht um Passung, sondern um Schaden. Ein Vorschussbetrug
   * kostet mehrere hundert Euro, die eine arbeitssuchende Person
   * gerade nicht hat.
   *
   * `null` in der Liste, ausgewertet auf der Detailseite. Die Prüfung
   * sucht Muster im Fliesstext — und den lädt die Ranglistenabfrage
   * nicht mehr. Sichtbar ist das Ergebnis ohnehin nur dort, wo eine
   * einzelne Stelle geöffnet ist; für tausend Anzeigen zu rechnen, was
   * bei einer gezeigt wird, war Aufwand ohne Empfänger.
   */
  scam: ScamAssessment | null;
  /** Wo dieselbe Stelle sonst noch steht. Leer, solange nur eine Quelle
   *  sie kennt — dann ist es keine Metasuche, sondern eine Liste, und
   *  das soll die Oberfläche nicht anders aussehen lassen. */
  alsoListedOn: { sourceName: string; url: string }[];
  reviews: ReviewAggregate[];
  themes: ReviewTheme[];
  confidence: ReturnType<typeof computeConfidence>;
  listingConfidence: ReturnType<typeof computeListingConfidence>;
}

/*
 * Kurzzeitgedächtnis für die Bewertung.
 *
 * `scoreAllJobs` liest alle Stellen, alle Anforderungen, alle Quellen
 * und alle Bewertungen und rechnet daraus die Passung — bei 994 Stellen
 * knapp drei Sekunden. Ein Klick auf „nächste Seite" ist derselbe
 * Aufruf mit demselben Ergebnis; ihn zweimal zu rechnen ist reine
 * Wartezeit.
 *
 * 45 Sekunden Haltbarkeit. Lange genug, dass Blättern und Filtern
 * sofort reagieren; kurz genug, dass eine frische Ingestion in
 * absehbarer Zeit sichtbar wird.
 *
 * Bewusst im Prozessspeicher und je Nutzer: die Bewertung enthält
 * dessen Bedingungen. Ein gemeinsamer Zwischenspeicher wäre ein Weg,
 * fremde Passungen zu sehen.
 */
const BEWERTUNG_TTL_MS = 45_000;
const bewertungsCache = new Map<string, { at: number; profil: string; jobs: ScoredJob[] }>();

/**
 * Wie viele bewertete Stellen insgesamt zwischengespeichert werden.
 *
 * ── Das Leck, das das schliesst ───────────────────────────────
 *
 * Der Zwischenspeicher hatte eine Frist, aber kein Aufräumen: Ein
 * Eintrag galt nach 45 Sekunden als veraltet und wurde neu berechnet
 * — er verschwand aber nie. Jede Person hinterliess dauerhaft eine
 * vollständige Kopie aller bewerteten Stellen.
 *
 * ── Warum eine feste Zahl von Personen nicht reicht ───────────
 *
 * Der erste Versuch behielt fünfzig Bewertungen. Das klingt sparsam
 * und ist es bei tausend Stellen auch. Bei 58.351 sind es je Person
 * mehr als hundert Megabyte — nach drei Prüfläufen standen 3.263 MB
 * im Speicher, bei einer Heapgrenze von 4.288.
 *
 * Die Grenze muss sich also am Bestand orientieren, nicht an einer
 * Zahl von Personen.
 *
 * ── Woher die 80.000 kommen ───────────────────────────────────
 *
 * Gemessen: Bei einem Budget von 300.000 standen nach vier
 * Prüfläufen 3.303 MB im Speicher. Rückgerechnet wiegt ein bewerteter
 * Datensatz rund **11 KB** — er trägt die ganze Stelle mit ihren
 * Listen und dazu Passung, Bedingungen, Sicherheit und Jobqualität.
 *
 * 80.000 sind damit rund 900 MB. Bei einem Bestand von 58.351 heisst
 * das: etwa eine gleichzeitige Bewertung. Das klingt wenig und ist
 * ehrlich — mehr trägt dieser Ansatz nicht.
 *
 * ── Und warum das die eigentliche Grenze ist ──────────────────
 *
 * Nicht der Zwischenspeicher ist zu klein, sondern der Ansatz zu
 * teuer: Für jede Person den ganzen Bestand zu bewerten und im
 * Speicher zu halten, skaliert nicht. Die Lösung ist, nur zu bewerten,
 * was gezeigt wird — grob vorsortieren in der Datenbank, dann die
 * oberen fünfzig genau rechnen.
 *
 * Bis dahin ist diese Zahl die Notbremse, die einen Absturz verhindert
 * und dafür öfter neu rechnet.
 */
const BEWERTUNGSPEICHER_STELLEN = Number(process.env.BEWERTUNGSPEICHER ?? 80_000);

/**
 * Abgelaufene und überzählige Bewertungen wegräumen.
 *
 * Läuft bei jedem Schreiben — dort, wo der Speicher wächst, und nicht
 * in einem Zeitgeber, der bei stillem Betrieb nie feuert.
 */
function bewertungenAufraeumen(): void {
  const jetzt = Date.now();
  for (const [k, v] of bewertungsCache) {
    if (jetzt - v.at >= BEWERTUNG_TTL_MS) bewertungsCache.delete(k);
  }
  /*
   * Reicht das nicht, fällt die älteste — gezählt in Stellen, nicht in
   * Personen. `Map` behält die Einfügereihenfolge, der erste Schlüssel
   * ist also der älteste Eintrag; kein Sortieren nötig.
   */
  let stellen = 0;
  for (const v of bewertungsCache.values()) stellen += v.jobs.length;
  while (stellen > BEWERTUNGSPEICHER_STELLEN && bewertungsCache.size > 1) {
    const aeltester = bewertungsCache.keys().next().value;
    if (aeltester === undefined) break;
    stellen -= bewertungsCache.get(aeltester)?.jobs.length ?? 0;
    bewertungsCache.delete(aeltester);
  }
}

/** Ändert sich das Profil, ist der Zwischenspeicher wertlos. */
function profilAbdruck(ctx: UserProfileContext): string {
  return JSON.stringify({
    e: ctx.evidence.length,
    // Bestätigte Belege ändern die Passung stärker als ihre Anzahl.
    b: ctx.evidence.filter((x) => x.userConfirmed).length,
    c: ctx.constraints,
    t: [ctx.energisingTasks.length, ctx.drainingTasks.length, ctx.rankedValues.length],
    p: ctx.profileConfirmed,
  });
}

/**
 * Der Stellenbestand — einmal für alle, nicht einmal je Person.
 *
 * ── Die Messung, die dazu geführt hat ─────────────────────────
 *
 * Beim ersten Aufruf von `/app/jobs` mit 5.424 Stellen:
 *
 *     [messung] 5424 Stellen · Abfragen 8343 ms · Bewerten 106 ms
 *
 * Das Bewerten war nie das Problem. Es waren die Abfragen — genauer:
 * die Menge, die dabei über die Leitung geht. `description_tokens`
 * allein sind 10 MB, dazu Aufgaben, Leistungen und der Rest. Bei einer
 * Datenbank in der Cloud ist das ein achtsekündiger Download.
 *
 * ── Warum ein gemeinsamer Zwischenspeicher richtig ist ────────
 *
 * Diese Zeilen hängen von keiner Person ab. Es sind dieselben Stellen,
 * dieselben Anforderungen, dieselben Quellen — für jede angemeldete
 * Person identisch. Sie je Aufruf neu zu holen ist kein Vorsichts-,
 * sondern ein Denkfehler: Der bestehende Zwischenspeicher liegt eine
 * Ebene zu hoch, nämlich hinter der Bewertung, und ist deshalb je
 * Person eigen.
 *
 * Personenbezogenes wird hier **nicht** abgelegt. Was hier liegt,
 * steht ohnehin in jedem Suchergebnis; die Bewertung darauf bleibt je
 * Person getrennt wie bisher.
 *
 * ── Warum die Frist kurz ist ──────────────────────────────────
 *
 * Ein Import läuft im Hintergrund weiter. Zwei Minuten alte Stellen
 * sind unproblematisch; zwanzig Minuten alte wären eine Liste, in der
 * neue Anzeigen unerklärlich fehlen.
 */
const BESTAND_TTL_MS = 120_000;

/**
 * ── Was hier früher stand ─────────────────────────────────────
 *
 * Rund dreihundert Zeilen: ein gemeinsamer Speicher für den ganzen
 * Bewertungsbestand, ein Fenster je Land, ein Nachführen der
 * Änderungen, ein Budget, drei Obergrenzen.
 *
 * Alles davon war Reparatur an einem Ansatz, der nicht trägt — für
 * jede Person den ganzen Bestand zu bewerten und im Speicher zu
 * halten. Jede Grenze verschob den Absturz, keine verhinderte ihn:
 *
 *   • 50.000 je Land → tot bei 147.706 Stellen
 *   • Wortmengen nachgeladen → tot beim ersten Profil, das sie brauchte
 *   • Nachführen begrenzt → tot nach ein paar Auffrischungen
 *   • Bewertungsspeicher geräumt → 3,4 GB im Ruhezustand
 *
 * Jetzt wählt die Datenbank aus (`kandidaten.ts`), und bewertet wird
 * nur, was ausgewählt wurde. Damit ist die Grösse des Bestands für die
 * Anwendung gleichgültig, und die ganze Maschinerie darüber
 * überflüssig.
 *
 * Die Messungen, die dorthin geführt haben, stehen in
 * `apps/web/SPEICHER.md`.
 */

/** Die Daten, aus denen eine Bewertung entsteht. */
interface Bestandsdaten {
  allJobRows: {
    job: JobZeileSchlank;
    companyName: string;
    mitarbeiter: string | null;
    branche: string | null;
    hauptsitz: string | null;
  }[];
  requirementRows: (typeof schema.jobRequirements.$inferSelect)[];
  sourceRows: (typeof schema.jobSources.$inferSelect)[];
  linkRows: (typeof schema.jobSourceLinks.$inferSelect)[];
  reviewRows: (typeof schema.reviewAggregates.$inferSelect)[];
  themeRows: (typeof schema.reviewThemes.$inferSelect)[];
}

/**
 * Wie lange die kleinen Tabellen gelten.
 *
 * Quellen, Bewertungen und Themen ändern sich selten; eine
 * Viertelstunde ist kurz genug, dass niemand lange einen alten Stand
 * sieht, und lang genug, dass die Abfrage selten ist.
 */
const VOLL_TTL_MS = 15 * 60_000;

/**
 * Die kleinen Tabellen — Quellen, Bewertungen, Themen.
 *
 * Sie hängen von keiner Person ab und sind zusammen ein Bruchteil der
 * Menge: ein paar hundert Quellen, ein paar tausend Bewertungen. Sie
 * je Aufruf neu zu holen wäre Verschwendung, sie je Person zu
 * speichern wäre es auch.
 *
 * Anders als der frühere Gesamtbestand wachsen sie nicht mit der Zahl
 * der Stellen — deshalb genügt hier ein schlichter Speicher mit Frist.
 */
let kleineSpeicher: {
  at: number;
  daten: Pick<Bestandsdaten, "sourceRows" | "linkRows" | "reviewRows" | "themeRows">;
} | null = null;

async function kleineTabellen() {
  if (kleineSpeicher && Date.now() - kleineSpeicher.at < VOLL_TTL_MS) return kleineSpeicher.daten;
  const db = await getDb();
  const [sourceRows, reviewRows, themeRows] = await Promise.all([
    db.select().from(schema.jobSources),
    db.select().from(schema.reviewAggregates),
    db.select().from(schema.reviewThemes),
  ]);
  /*
   * Fundstellen bleiben leer.
   *
   * Sie werden in der Bewertung nur gezählt, um Wiederholungen
   * derselben Anzeige zu erkennen — bei 800.000 Stellen sind es
   * Hunderttausende Zeilen für ein Signal, das die Entdopplung beim
   * Import ohnehin schon angewendet hat.
   */
  const daten = { sourceRows, linkRows: [], reviewRows, themeRows };
  kleineSpeicher = { at: Date.now(), daten };
  return daten;
}

/**
 * Die Wortmengen — nachgeladen, nur wenn ein Profil sie braucht.
 *
 * ── Warum getrennt vom Bestand ────────────────────────────────
 *
 * Sie sind 82 der 111 MB je Ladevorgang. `computeFit` liest sie an
 * genau zwei Stellen — Arbeitsstil und Werte — und beide laufen nur,
 * wenn die Person entsprechende Angaben gemacht hat. Für alle anderen
 * wurden drei Viertel der Übertragung für nichts bezahlt.
 *
 * Der Speicher ist gemeinsam wie der Bestand: Die erste Person mit
 * einem passenden Profil holt sie, alle weiteren bekommen sie
 * geschenkt.
 */

/**
 * Die Wortmengen der übergebenen Stellen.
 *
 * ── Warum kein gemeinsamer Speicher mehr ──────────────────────
 *
 * Vorher lagen sie für den ganzen Bestand in einer Map. Bei 741.059
 * Stellen und rund 1,2 KB je Wortmenge war das fast ein Gigabyte in
 * einem Zug — der Server starb daran mit „Reached heap limit".
 *
 * Jetzt kommen sie für die Kandidaten dieser Person, also für
 * zweitausend Zeilen. Das ist wenig genug, um es je Aufruf zu holen,
 * und macht jeden Zwischenspeicher überflüssig — mitsamt der Frage,
 * wann er veraltet.
 */
async function wortmengen(daten: Bestandsdaten): Promise<Map<string, string>> {
  const kennungen = daten.allJobRows.map((z) => z.job.id);
  if (kennungen.length === 0) return new Map();

  const db = await getDb();
  const zeilen = await db
    .select({ id: schema.jobs.id, tokens: schema.jobs.descriptionTokens })
    .from(schema.jobs)
    .where(inArray(schema.jobs.id, kennungen));
  return new Map(zeilen.map((z) => [z.id, z.tokens ?? ""]));
}

/**
 * Braucht dieses Profil die Wortmengen überhaupt?
 *
 * Nur wer Arbeitsstil-Vorlieben oder gewichtete Werte hinterlegt hat.
 * Ohne beides liest `computeFit` sie nicht an — und dann wären es 82 MB
 * für nichts.
 */
function brauchtWortmengen(ctx: UserProfileContext): boolean {
  return ctx.workStylePreferences.length > 0 || ctx.rankedValues.length > 0;
}

/**
 * Die Zwischenspeicher verwerfen.
 *
 * Für Tests und für den Importlauf: Wer Stellen schreibt und danach
 * liest, soll nicht eine Viertelstunde lang den alten Stand sehen.
 */
export function bestandVergessen(): void {
  kleineSpeicher = null;
  bewertungsCache.clear();
}

export async function scoreAllJobs(
  userId: string,
  ctx: UserProfileContext,
  vorauswahl?: Vorauswahl,
): Promise<ScoredJob[]> {
  /*
   * Der Suchbegriff gehört in den Abdruck.
   *
   * Sonst bekäme dieselbe Person für „Erzieher" die Kandidaten ihrer
   * vorherigen Suche — zwischengespeichert und falsch.
   */
  const abdruck = `${profilAbdruck(ctx)}|${vorauswahl?.suche ?? ""}|${vorauswahl?.ort ?? ""}|${vorauswahl?.bedarf ?? ""}`;
  const gemerkt = bewertungsCache.get(userId);
  if (gemerkt && gemerkt.profil === abdruck && Date.now() - gemerkt.at < BEWERTUNG_TTL_MS) {
    return gemerkt.jobs;
  }

  const ergebnis = await scoreAllJobsUncached(userId, ctx, vorauswahl);
  bewertungsCache.set(userId, { at: Date.now(), profil: abdruck, jobs: ergebnis });
  bewertungenAufraeumen();
  return ergebnis;
}

/**
 * Wie viele Kandidaten je Person bewertet werden.
 *
 * ── Warum das die Zahl ist, auf die es ankommt ────────────────
 *
 * Ein bewerteter Datensatz wiegt gemessen rund 11 KB. Zweitausend
 * sind damit 22 MB je Person — statt 640 MB für den ganzen Bestand.
 * Erst damit ist die Grösse des Bestands für die Anwendung gleichgültig.
 *
 * ── Warum zweitausend genug sind ──────────────────────────────
 *
 * Es sind nicht die zweitausend beliebigsten, sondern die neuesten,
 * die die harten Bedingungen der Person nicht verletzen. Wer eine
 * Gehaltsuntergrenze und ein Arbeitsmodell gesetzt hat, bekommt
 * zweitausend Stellen, die beides erfüllen — mehr, als jemand je
 * durchsieht, und relevanter als hunderttausend ungefilterte.
 */
const KANDIDATEN_HOECHSTENS = Number(process.env.BEWERTUNG_KANDIDATEN ?? 2_000);

/**
 * Wie viele Kandidaten für eine bestimmte Listenlänge nötig sind.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nicht immer zweitausend
 * ══════════════════════════════════════════════════════════════
 *
 * Die Zahl war eine Obergrenze gegen den Arbeitsspeicher — und wurde
 * zur Untergrenze: Jeder Seitenaufbau holte zweitausend Zeilen,
 * gleich ob fünfundzwanzig oder hundert gezeigt wurden.
 *
 * Gemessen am 6. September 2026 an 2,6 Mio. Anzeigen, warme Datenbank:
 *
 *   limit 2000   397 ms
 *   limit 1000   119 ms
 *   limit  600    90 ms
 *   limit  300    66 ms
 *
 * Der Sprung zwischen 600 und 2000 ist überproportional — und er
 * wird für Zeilen bezahlt, die niemand sieht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum trotzdem ein Vielfaches der Listenlänge
 * ══════════════════════════════════════════════════════════════
 *
 * Weil zwischen Auswahl und Liste noch gefiltert wird: Abgelegtes
 * fällt weg, Doppelte fallen weg, veraltete Anzeigen fallen weg, und
 * die eingetippten Filter — Arbeitszeit, Schicht, Fahrzeit — nehmen
 * noch einmal die Hälfte.
 *
 * Faktor zwölf mit einer Untergrenze von 600: Wer fünfundzwanzig
 * Stellen sieht, bekommt sie aus 600 bewerteten; wer bis 150 blättert,
 * aus 1.800. Die alte Obergrenze bleibt die Obergrenze.
 */
export function kandidatenBedarf(sichtbar: number): number {
  const noetig = Math.max(600, Math.ceil(sichtbar) * 12);
  return Math.min(noetig, KANDIDATEN_HOECHSTENS);
}

async function scoreAllJobsUncached(
  userId: string,
  ctx: UserProfileContext,
  vorauswahl?: Vorauswahl,
): Promise<ScoredJob[]> {
  /*
   * Aus dem gemeinsamen Zwischenspeicher — siehe `bestand()`.
   *
   * Hier standen sechs Abfragen, die bei jedem Aufruf jeder Person
   * denselben Bestand neu holten. Gemessen im laufenden Server:
   *
   *     [messung] 5425 Stellen · Abfragen 6578 ms · Bewerten 107 ms
   *
   * Das Bewerten war nie das Problem.
   */
  /*
   * ── Die Datenbank wählt aus, nicht der Arbeitsspeicher ────
   *
   * Hier stand `await bestand()` — der ganze Bewertungsbestand, für
   * jede Person neu bewertet und zwischengespeichert. Bei 11 KB je
   * bewertetem Datensatz waren das 640 MB je gleichzeitiger Person,
   * und der Server ist mehrfach daran gestorben.
   *
   * Jetzt kommen nur die Kandidaten — die neuesten Stellen, die die
   * harten Bedingungen dieser Person nicht verletzen. Damit ist die
   * Grösse des Bestands für die Anwendung gleichgültig: Ob 800.000
   * oder acht Millionen Stellen in der Datenbank stehen, bewertet
   * werden zweitausend.
   */
  const daten = await kandidatenLaden(
    ctx,
    vorauswahl?.bedarf ?? KANDIDATEN_HOECHSTENS,
    vorauswahl,
  );
  return bewerten(daten, ctx, brauchtWortmengen(ctx) ? await wortmengen(daten) : null);
}

/**
 * Die Kandidaten dieser Person laden — Stellen, Firmen, Anforderungen.
 *
 * Die kleinen Tabellen (Quellen, Bewertungen, Themen) kommen weiter
 * aus dem gemeinsamen Speicher: Sie hängen von keiner Person ab und
 * sind zusammen ein Bruchteil der Menge.
 */
async function kandidatenLaden(
  ctx: UserProfileContext,
  grenze: number,
  vorauswahl?: Vorauswahl,
): Promise<Bestandsdaten> {
  const db = await getDb();
  const t0 = Date.now();

  /*
   * Sortiert wird nur ohne Textbedingung.
   *
   * Mit einer zwingt die Sortierung die Datenbank, erst alle Treffer
   * zu holen — bei „Berlin" sind das Zehntausende, und die Abfrage
   * brauchte gemessen 37 Sekunden. Das Zeitfenster in
   * `kandidatenBedingung` übernimmt dann ihre Aufgabe.
   */
  const grundlage = db
    .select({
      job: JOB_SPALTEN_SCHLANK,
      companyName: schema.companies.name,
      mitarbeiter: schema.companies.mitarbeiter,
      branche: schema.companies.industry,
      hauptsitz: schema.companies.headquarters,
    })
    .from(schema.jobs)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
    .where(kandidatenBedingung(ctx.constraints, vorauswahl));

  const allJobRows = await (brauchtReihenfolge(vorauswahl)
    ? grundlage.orderBy(KANDIDATEN_REIHENFOLGE).limit(grenze)
    : grundlage.limit(grenze));

  const tStellen = Date.now();
  const kennungen = allJobRows.map((z) => z.job.id);

  /*
   * Anforderungen nur für die Kandidaten.
   *
   * Vorher wurde die ganze Tabelle geladen — bei 800.000 Stellen sind
   * das Hunderttausende Zeilen, von denen zweitausend gebraucht werden.
   */
  const requirementRows =
    kennungen.length === 0
      ? []
      : await db
          .select()
          .from(schema.jobRequirements)
          .where(inArray(schema.jobRequirements.jobId, kennungen));

  const tAnforderungen = Date.now();
  const klein = await kleineTabellen();
  const tKlein = Date.now();
  console.log(
    `[kandidaten] ${allJobRows.length} Stellen · ${requirementRows.length} Anforderungen in ${Date.now() - t0} ms` +
      ` (Stellen ${tStellen - t0} · Anforderungen ${tAnforderungen - tStellen} · kleine Tabellen ${tKlein - tAnforderungen})`,
  );

  return { allJobRows, requirementRows, ...klein };
}

/**
 * Die Bewertung selbst — für den ganzen Bestand oder für eine Zeile.
 *
 * Herausgelöst, weil zwei Wege sie brauchen: die Rangfolge über alle
 * Stellen und der Einzelabruf für eine Stelle ausserhalb des Fensters.
 * Zwei Bewertungen nebeneinander wären der Anfang genau des Problems,
 * das dieses Projekt an anderen Stellen schon hatte — sie laufen
 * auseinander, und niemand weiss, welche recht hat.
 */
function bewerten(
  daten: Bestandsdaten,
  ctx: UserProfileContext,
  wortmengenNach: Map<string, string> | null,
): ScoredJob[] {
  const { allJobRows, requirementRows, sourceRows, linkRows, reviewRows, themeRows } = daten;

  /*
   * Erfundene Stellen erscheinen nicht in der Produktoberfläche.
   *
   * Die Regel steht jetzt in der Abfrage oben (`isDemo = false`) statt
   * hier als Filter danach. Sachlich unverändert: Seed-Datensätze
   * werden NIE ausgeliefert, auch nicht, wenn dadurch die Liste leer
   * bleibt. Eine leere Liste ist eine wahre Aussage über den Zustand
   * des Produkts; eine mit erfundenen Stellen gefüllte ist eine
   * falsche, und die Kennzeichnung daneben trägt sie nicht.
   */
  const jobRows = allJobRows;

  // Die weiteren Fundstellen derselben Stelle. Ein Abruf für alle
  // Stellen; pro Stelle einzeln nachzufragen wäre bei 150 Anzeigen
  // genau die Art von Abfrage, die eine Liste langsam macht.

  // Reposts erkennen: gleiche Inhalte, früher erfasst.
  const byHash = new Map<string, Date[]>();
  for (const { job } of jobRows) {
    const list = byHash.get(job.contentHash) ?? [];
    list.push(job.publishedAt ?? job.fetchedAt);
    byHash.set(job.contentHash, list);
  }

  const now = new Date();

  /*
   * Einmal nach Schlüssel ordnen statt bei jeder Stelle neu suchen.
   *
   * Vorher lief in der Schleife über 994 Stellen je ein `filter` über
   * 636 Anforderungen, ein `find` über die Quellen und zwei weitere
   * `filter` über Bewertungen und Themen. Das sind mehr als 600.000
   * Vergleiche für eine einzige Seitenansicht — Arbeit, die quadratisch
   * mit dem Bestand wächst und niemandem auffällt, solange die
   * Datenbank klein ist.
   *
   * Mit vorher gebauten Karten ist es ein Nachschlagen je Stelle. Das
   * Ergebnis ist Zeichen für Zeichen dasselbe.
   */
  const anforderungenJeJob = new Map<string, JobRequirement[]>();
  for (const r of requirementRows) {
    const liste = anforderungenJeJob.get(r.jobId) ?? [];
    liste.push({
      id: r.id,
      jobId: r.jobId,
      kind: r.kind,
      text: r.text,
      skillKey: r.skillKey,
      category: r.category as JobRequirement["category"],
    });
    anforderungenJeJob.set(r.jobId, liste);
  }

  const quelleJeId = new Map(sourceRows.map((s) => [s.id, s]));

  const bewertungenJeFirma = new Map<string, ReviewAggregate[]>();
  for (const r of reviewRows) {
    const liste = bewertungenJeFirma.get(r.companyId) ?? [];
    liste.push({ ...r, ratingScaleMax: r.ratingScaleMax } as ReviewAggregate);
    bewertungenJeFirma.set(r.companyId, liste);
  }

  const themenJeFirma = new Map<string, ReviewTheme[]>();
  for (const t of themeRows) {
    const liste = themenJeFirma.get(t.companyId) ?? [];
    liste.push(t as ReviewTheme);
    themenJeFirma.set(t.companyId, liste);
  }

  /* Auch die Fundstellen einmal nach Stelle ordnen — derselbe Grund. */
  const fundstellenJeJob = new Map<string, typeof linkRows>();
  for (const l of linkRows) {
    const liste = fundstellenJeJob.get(l.jobId) ?? [];
    liste.push(l);
    fundstellenJeJob.set(l.jobId, liste);
  }

  const LEER_ANFORDERUNGEN: JobRequirement[] = [];
  const LEER_BEWERTUNGEN: ReviewAggregate[] = [];
  const LEER_THEMEN: ReviewTheme[] = [];

  return jobRows.map(({ job: row, companyName, mitarbeiter, branche, hauptsitz }) => {
    const job = rowToJob(row, companyName, wortmengenNach?.get(row.id) ?? "");
    const requirements = anforderungenJeJob.get(job.id) ?? LEER_ANFORDERUNGEN;
    const source = quelleJeId.get(job.sourceId ?? "") ?? null;
    const reviews = bewertungenJeFirma.get(job.companyId) ?? LEER_BEWERTUNGEN;
    const themes = themenJeFirma.get(job.companyId) ?? LEER_THEMEN;

    const mine = job.publishedAt ?? job.fetchedAt;
    const earlierDuplicates = (byHash.get(job.contentHash) ?? []).filter(
      (d) => d.getTime() < mine.getTime(),
    ).length;

    /*
     * Die Rechnung selbst steht in `@paycheck/matching`.
     *
     * Sie stand bis hierher mitten in dieser Schleife. Der
     * Hintergrunddienst des Suchauftrags läuft als Skript ohne Next.js
     * und kam nicht an sie heran — die naheliegende Lösung wäre eine
     * zweite Fassung dort gewesen. Zwei Fassungen derselben Formel
     * laufen beim ersten Eingriff auseinander, und die Person sieht
     * dann in der Liste 74 und in der Mail 81.
     */
    const bewertung = stelleBewerten({
      job,
      requirements,
      source: source as JobSource | null,
      reviews,
      themes,
      mitarbeiter,
      earlierDuplicateCount: earlierDuplicates,
      profil: ctx,
      commute: commuteEstimator,
      now,
    });
    const {
      constraints, fit, confidence, jobQuality, anzeige, aiTransition,
      listingConfidence, overall, salaryPerYear, commuteMinutes,
    } = bewertung;

    // Nur ANDERE Quellen. Die eigene noch einmal als "auch gelistet bei"
    // zu zeigen, wäre eine Behauptung über Reichweite, die nicht stimmt.
    const alsoListedOn = (fundstellenJeJob.get(job.id) ?? [])
      .filter((l) => l.sourceId !== job.sourceId && l.url)
      .map((l) => ({
        sourceName: quelleJeId.get(l.sourceId ?? "")?.displayName ?? "unbekannt",
        url: l.url,
      }));

    return {
      jobId: job.id,
      job,
      requirements,
      source: source as JobSource | null,
      // Erst wenn jemand diese Stelle öffnet. `mitBetrugspruefung`
      // füllt das Feld dann für genau diese eine Anzeige.
      scam: null,
      alsoListedOn,
      reviews,
      themes,
      /* Transparenz der Anzeige — getrennt von den Bedingungen. */
      anzeige,
      overall,
      fit,
      confidence,
      jobQuality,
      aiTransition,
      listingConfidence,
      constraints,
      salaryPerYear,
      commuteMinutes,
      publishedAt: job.publishedAt,
      firma: { mitarbeiter, branche, hauptsitz },
    };
  });
}

export interface JobListOptions {
  sort?: SortKey;
  includeBlocked?: boolean;
  limit?: number;
  /**
   * Der eingegebene Suchbegriff.
   *
   * Er muss bis in die Kandidatenauswahl durchgereicht werden. Erst
   * bewerten und dann filtern hiesse: gesucht wird nur in den 2.000
   * neuesten Stellen — bei „Data Engineer" waren das null von 996.
   */
  suche?: string | null;
  /**
   * Wie viele Stellen die Seite zeigen will.
   *
   * Entscheidet, wie gross die bewertete Auswahl sein muss. Ohne
   * Angabe bleibt es bei der alten Obergrenze — dann weiss der
   * Aufrufer es selbst nicht besser.
   */
  sichtbar?: number;
  /**
   * Der Ort — aus demselben Grund wie der Suchbegriff.
   *
   * Er wurde bisher NACH der Bewertung gefiltert: 2.000 Anzeigen aus
   * ganz Deutschland, davon dann die aus Karlsruhe. Bei „Bayern"
   * blieben davon eine Handvoll übrig, und die Liste sah aus, als
   * gäbe es dort kaum Stellen.
   */
  ort?: string | null;
}

/**
 * Eine Stelle ist nicht mehr aktuell, wenn ihr Ablaufdatum vorbei ist
 * oder die letzte Linkprüfung fehlgeschlagen hat.
 *
 * Beides bedeutet dasselbe für die Person: eine Bewerbung dort geht ins
 * Leere. Eine abgelaufene Anzeige im Ranking ist nicht bloss veraltete
 * Information — sie kostet Arbeit, die niemand liest.
 *
 * Aus der Rangfolge fliegt sie deshalb raus. Von der Detailseite nicht:
 * wer sich die Stelle gemerkt hat, soll seinen eigenen Vorgang
 * weiterhin sehen können, dort dann mit Hinweis.
 */
export function isStale(job: ScoredJob["job"], now = new Date()): boolean {
  if (job.expiresAt && job.expiresAt.getTime() < now.getTime()) return true;
  if (job.lastLinkCheckOk === false) return true;
  return false;
}

/**
 * Eignung vor Rangfolge.
 *
 * ── Was vorher geschah ─────────────────────────────────────────
 *
 * Alle Stellen wurden bewertet, sortiert und angezeigt; erst danach
 * verschwanden die verletzenden. Was dabei durchrutschte, war die
 * mittlere Gruppe: Stellen, bei denen eine harte Bedingung schlicht
 * offen ist, weil die Anzeige nichts dazu sagt. Die standen zwischen
 * den geprüften, mit Passungswert und Empfehlung, und nichts an ihnen
 * verriet, dass die eigene Gehaltsuntergrenze bei ihnen ungeprüft war.
 *
 * Unbekannt sah aus wie erfüllt. Das ist der teuerste Fehler dieser
 * Anwendung, weil er nicht auffällt: die Stelle wirkt geprüft, jemand
 * bewirbt sich, und die Bedingung stellt sich erst im Gespräch als
 * verletzt heraus.
 *
 * ── Jetzt: drei Gruppen, getrennt gehalten ─────────────────────
 *
 *   `jobs`      erfüllt nachweislich alle harten Bedingungen.
 *   `klaerung`  mindestens eine Bedingung ist offen. Eigener
 *               Abschnitt, mit dem Punkt, der offen ist.
 *   `gesperrt`  verletzt nachweislich eine Bedingung.
 *
 * Die Sortierung läuft je Gruppe. Eine Stelle mit offener Bedingung
 * kann in ihrer Gruppe oben stehen, ohne deshalb vor einer geprüften
 * Stelle zu erscheinen — die Reihenfolge zwischen den Gruppen ist keine
 * Frage des Passungswerts.
 */
/**
 * Dieselbe Stelle nur einmal — beim Lesen, nicht erst beim Import.
 *
 * ── Warum das hier nötig ist, obwohl der Import dedupliziert ──
 *
 * `ingest.ts` führt zusammen, was es als dieselbe Stelle erkennt, und
 * macht das gut. Es kommt aber nur an die Zeilen, die durch den Import
 * laufen — und nicht an das, was schon in der Datenbank liegt: früher
 * unter einem anderen Ortsnamen importiert („Köln" gegen „Köln,
 * Nordrhein-Westfalen"), von Arbeitgebern direkt eingestellt, oder aus
 * einer Zeit vor der jetzigen Regel.
 *
 * Ein Filter beim Lesen ist die zweite Linie: Er wirkt sofort auf den
 * Bestand, unabhängig davon, wie eine Zeile hineingekommen ist.
 *
 * ── Welche bleibt ─────────────────────────────────────────────
 *
 * Die mit der besseren Datenlage: erst Gehalt, dann Wochenstunden, dann
 * die neuere. Nicht die zuerst gefundene — sonst entscheidet die
 * Reihenfolge des Imports darüber, welche Fassung jemand zu sehen
 * bekommt.
 */
/**
 * Dubletten zusammenfassen — exportiert, damit die Laufzeit prüfbar ist.
 *
 * Der Aufwand dieser Funktion entscheidet, ob ein fünfstelliger
 * Bestand eine Sekunde oder eine Minute kostet. Eine solche Eigenschaft
 * gehört unter einen Test und nicht in einen Kommentar.
 */
export function entdoppeln(jobs: ScoredJob[]): ScoredJob[] {
  /*
   * Die Stelle UND ihr Platz in der Ausgabe.
   *
   * ── Warum das kein Feinschliff ist ────────────────────────
   *
   * Hier stand `raus.indexOf(vorhanden)`. Das durchsucht die
   * bisherige Ausgabe von vorn — für jede gefundene Dublette. Bei
   * wenigen hundert Stellen kostet das nichts; bei 5.307 war es
   * bereits messbar, und der Aufwand wächst im Quadrat: zehnmal so
   * viele Stellen sind hundertmal so viel Arbeit.
   *
   * Genau die falsche Eigenschaft für eine Funktion, die künftig
   * fünfstellige Bestände sieht. Der Platz ist bekannt, wenn man ihn
   * beim Einfügen merkt — dann ist Ersetzen eine Zuweisung statt
   * einer Suche.
   */
  const nachSchluessel = new Map<string, { j: ScoredJob; platz: number }>();
  const raus: ScoredJob[] = [];

  const guete = (j: ScoredJob) =>
    (j.job.salary.min !== null || j.job.salary.max !== null ? 4 : 0) +
    (j.job.weeklyHours !== null ? 2 : 0) +
    (j.job.description !== null ? 1 : 0);

  for (const j of jobs) {
    const k = canonicalKey({
      title: j.job.title,
      companyName: j.job.companyName,
      location: j.job.location,
    });

    /*
     * Ohne Schlüssel keine Zusammenfassung.
     *
     * `canonicalKey` gibt `null` zurück, wenn Titel, Firma oder Ort
     * fehlen. Dann ist keine verlässliche Aussage möglich, und im
     * Zweifel bleiben zwei Zeilen stehen — eine zu viel ist besser als
     * eine zu wenig.
     */
    if (!k) {
      raus.push(j);
      continue;
    }

    const vorhanden = nachSchluessel.get(k);
    if (!vorhanden) {
      nachSchluessel.set(k, { j, platz: raus.length });
      raus.push(j);
      continue;
    }
    if (guete(j) > guete(vorhanden.j)) {
      /* Die bessere Fassung ersetzt die schlechtere an Ort und Stelle. */
      raus[vorhanden.platz] = j;
      nachSchluessel.set(k, { j, platz: vorhanden.platz });
    }
  }

  return raus;
}

export async function listJobsForUser(
  userId: string,
  ctx: UserProfileContext,
  options: JobListOptions = {},
): Promise<{
  jobs: ScoredJob[];
  klaerung: ScoredJob[];
  blockedCount: number;
  staleCount: number;
}> {
  const [bewertet, abgelegt] = await Promise.all([
    scoreAllJobs(userId, ctx, {
      suche: options.suche,
      ort: options.ort,
      bedarf: options.sichtbar ? kandidatenBedarf(options.sichtbar) : KANDIDATEN_HOECHSTENS,
    }),
    abgelegteStellen(userId),
  ]);

  /*
   * Abgelegtes kommt nicht wieder.
   *
   * Ohne diesen Schritt wäre „Passt nicht" eine Attrappe: Die
   * Ablehnung landete in der Tabelle, die Stelle stünde beim nächsten
   * Laden wieder da, und die Person legte sie ein zweites Mal ab.
   *
   * Das Ablegen ist bewusst endgültig für die Liste und trotzdem
   * nicht endgültig für die Stelle — sie bleibt über ihre eigene
   * Adresse erreichbar. Was verschwindet, ist der Vorschlag, nicht
   * die Möglichkeit.
   */
  const all = entdoppeln(bewertet).filter((j) => !abgelegt.has(j.jobId));

  const stale = all.filter((j) => isStale(j.job));
  const current = all.filter((j) => !isStale(j.job));

  const geeignet: ScoredJob[] = [];
  const offen: ScoredJob[] = [];
  const gesperrt: ScoredJob[] = [];

  for (const j of current) {
    if (j.constraints.overall === "blocked") gesperrt.push(j);
    else if (j.constraints.overall === "uncertain") offen.push(j);
    else geeignet.push(j);
  }

  const sortieren = (liste: ScoredJob[]) =>
    sortJobs(liste, options.sort ?? "best_overall") as ScoredJob[];

  /*
   * Die Einstellung der Person entscheidet, nicht die Voreinstellung
   * des Systems. „ausblenden" heisst wirklich ausblenden — mit Zähler,
   * damit die Stellen nicht spurlos verschwinden.
   */
  const wie = ctx.constraints.unklaresBehandeln;
  const haupt = wie === "mitzeigen" ? [...geeignet, ...offen] : geeignet;
  const zurKlaerung = wie === "mitzeigen" || wie === "ausblenden" ? [] : offen;

  const sichtbar = options.includeBlocked ? [...haupt, ...gesperrt] : haupt;
  const sortiert = sortieren(sichtbar);

  return {
    jobs: options.limit ? sortiert.slice(0, options.limit) : sortiert,
    klaerung: sortieren(zurKlaerung),
    blockedCount: gesperrt.length,
    staleCount: stale.length,
  };
}

/**
 * Eine einzelne Stelle — vollständig.
 *
 * Zwei Dinge holt diese Funktion nach, die der Liste bewusst fehlen:
 * den Beschreibungstext und die Betrugsprüfung. Beides kostet für eine
 * Anzeige fast nichts und für tausend zu viel, und beides wird nur hier
 * gebraucht: die Beschreibung, weil die Detailseite sie zeigt, die
 * Prüfung, weil sie Muster im Fliesstext sucht.
 *
 * Die Bewertung selbst wird NICHT neu gerechnet. Sie steht schon fest
 * und ist dieselbe wie in der Liste — sonst könnte eine Stelle beim
 * Öffnen plötzlich einen anderen Wert zeigen als in der Zeile darüber.
 */
export async function loadScoredJob(userId: string, jobId: string): Promise<ScoredJob | null> {
  /*
   * Die Beschreibung braucht das Profil nicht.
   *
   * Sie stand hinter der Bewertung und wartete damit auf eine
   * Transaktion, mit der sie nichts zu tun hat — 43 Millisekunden für
   * eine Abfrage, die von Anfang an hätte unterwegs sein können. Sie
   * hängt allein an der Stellenkennung, und die steht im Aufruf.
   */
  const beschreibungLaeuft = getDb().then((db) =>
    db
      .select({
        description: schema.jobs.description,
        /* Für die Übersetzung: Sie darf nur laufen, wenn die Sprache
           sicher eine andere ist. */
        originalLanguage: schema.jobs.originalLanguage,
      })
      .from(schema.jobs)
      .where(eq(schema.jobs.id, jobId))
      .limit(1),
  );

  const ctx = await loadProfileContext(userId);
  const all = await scoreAllJobs(userId, ctx);
  let treffer = all.find((j) => j.jobId === jobId) ?? null;

  /*
   * ── Die Obergrenze begrenzt die Rangfolge, nicht den Zugriff ──
   *
   * Bewertet werden die neuesten Stellen je Land (siehe
   * `jeLandHoechstens()`) — sonst stirbt der Prozess am
   * Arbeitsspeicher. Wer aber einen Link zu einer älteren Stelle
   * öffnet, hat einen guten Grund: aus einer Merkliste, aus einer
   * Bewerbung, aus einer E-Mail.
   *
   * Ohne diesen Rückfall bekam er eine leere Seite — und zwar
   * kommentarlos, weil `null` hier „gibt es nicht" heisst. Die Stelle
   * gibt es aber; sie steht nur ausserhalb des Fensters.
   *
   * Eine Stelle einzeln zu bewerten kostet nichts Nennenswertes: Der
   * Bestand liegt bereits im Speicher, es fehlt genau diese eine Zeile.
   */
  if (!treffer) treffer = await einzelneStelleBewerten(userId, ctx, jobId);
  if (!treffer) return null;

  const [zeile] = await beschreibungLaeuft;
  const beschreibung = zeile?.description ?? "";

  const job: Job = { ...treffer.job, description: beschreibung };
  /* Die Originalsprache reist mit der Stelle mit — die Seite
     entscheidet damit, ob sie übersetzen lässt. */
  const originalLanguage = zeile?.originalLanguage ?? null;
  return {
    ...treffer,
    job,
    scam: assessScamSignals({
      title: job.title,
      description: beschreibung,
      companyName: job.companyName,
      originalUrl: job.originalUrl,
      fromEmployerFeed: treffer.source?.kind === "employer_feed",
      // Verifiziert ist eine Domäne erst, wenn sie in employer_boards
      // steht. Solange es dort keinen Eintrag gibt, ist "geprüfte
      // Quelle" eine Auszeichnung, die niemand verdient hat.
      employerDomainVerified: false,
    }),
    originalLanguage,
  };
}

/**
 * Schreibt das Ergebnis fort, damit ein später angezeigter Wert erklärbar
 * bleibt - mitsamt der Fassung der Bewertungslogik, die ihn erzeugt hat.
 */
export async function persistMatch(userId: string, scored: ScoredJob): Promise<void> {
  const db = await getDb();

  /*
   * Welche Punkte diese Person nicht verhandelt.
   *
   * Zwei Quellen, die sich absichtlich nicht überschneiden:
   * `scored.constraints.blockedBy` ist das Formular, `preferences` ist
   * das Gespräch. Wer nur eine liest, behandelt die andere Hälfte
   * stillschweigend als weich — die Person sagt „unter 60.000 nicht"
   * und bekommt weiter Stellen für 48.000.
   *
   * Der Aufruf steht bewusst VOR `withUser`: Er öffnet selbst eine
   * Sitzung mit gesetzter Nutzerkennung, und die in eine laufende zu
   * schachteln kostet vier zusätzliche Rundläufe für nichts.
   */
  const harteBedingungen = new Set([
    ...scored.constraints.blockedBy,
    ...(await harteBedingungenLaden(userId)),
  ]);

  await withUser(db, userId, async (tx) => {


    const [match] = await tx
      .insert(schema.jobMatches)
      .values({
        userId,
        jobId: scored.jobId,
        fitScore: scored.fit.score,
        fitBand: scored.fit.band,
        fitCoverage: scored.fit.coverage,
        confidenceScore: scored.confidence.score,
        jobQualityScore: scored.jobQuality.score,
        listingConfidenceScore: scored.listingConfidence.score,
        aiTransitionCategory: scored.aiTransition.category,
        overallScore: scored.overall.score,
        constraintVerdict: scored.constraints.overall,
        topReason: scored.fit.topReason,
        topReservation: scored.fit.topReservation,
        scoringVersion: scored.fit.version,
        computedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.jobMatches.userId, schema.jobMatches.jobId],
        set: {
          fitScore: scored.fit.score,
          fitBand: scored.fit.band,
          overallScore: scored.overall.score,
          computedAt: new Date(),
        },
      })
      .returning();

    if (!match) return;
    await tx.delete(schema.matchFactors).where(eq(schema.matchFactors.matchId, match.id));

    const factors = [
      ...scored.fit.factors.map((f) => ({ ...f, scoreKind: "fit" })),
      ...scored.confidence.factors.map((f) => ({ ...f, scoreKind: "confidence" })),
      ...scored.jobQuality.dimensions.map((f) => ({ ...f, scoreKind: "job_quality" })),
    ];
    if (factors.length > 0) {
      await tx.insert(schema.matchFactors).values(
        factors.map((f) => ({
          matchId: match.id,
          scoreKind: f.scoreKind,
          key: f.key,
          label: f.label,
          raw: f.raw,
          weight: f.weight,
          contribution: f.contribution,
          explanation: f.explanation,
          evidenceIds: f.evidenceIds,
          /*
           * Was für eine Aussage das ist — nicht nur, wie stark sie ist.
           *
           * Ohne diese Einstufung sind „drei Remote-Tage statt vier" und
           * „C1 gefordert, du hast B2" beide nur eine kleine Zahl. Das
           * erste ist ein Kompromiss, das zweite beendet die Bewerbung.
           *
           * `harteBedingungen` kommt aus den Präferenzen der Person:
           * Dieselbe Sache ist für die eine verhandelbar und für die
           * andere nicht, und nur sie selbst kann das sagen.
           */
          ...einstufen(f, harteBedingungen.has(f.key)),
        })),
      );
    }
  });
}

/*
 * Ereignisse, aus denen ein Ergebnis wird.
 *
 * `job_viewed` und `job_saved` stehen bewusst nicht darin. Ein Klick
 * sagt, was jemand interessant fand — nicht, ob es ihm gutgetan hat.
 * Genau diese Verwechslung soll der Outcome Loop vermeiden.
 */
const ERGEBNISEREIGNISSE = new Set([
  "application_started", "application_sent", "acknowledged", "response_received",
  "interview_scheduled", "interview_held", "offer_received", "accepted", "rejected",
]);

export async function recordEvent(
  userId: string,
  type: (typeof schema.applicationEvents.$inferInsert)["type"],
  opts: { jobId?: string; applicationId?: string } = {},
): Promise<void> {
  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx.insert(schema.applicationEvents).values({
      userId,
      type,
      jobId: opts.jobId ?? null,
      applicationId: opts.applicationId ?? null,
      occurredAt: new Date(),
    }),
  );

  /*
   * Der Outcome Loop hängt hier, an der einen Stelle, durch die alles
   * läuft.
   *
   * Ihn an jeden Aufrufer zu hängen hiesse, ihn irgendwann irgendwo zu
   * vergessen — und eine Lücke in dieser Aufzeichnung lässt sich nicht
   * nachholen, weil das Ereignis vorbei ist.
   *
   * Bei einem Stufenwechsel steht nur die Bewerbungskennung zur
   * Verfügung; die Stelle wird dann nachgeschlagen.
   */
  if (!ERGEBNISEREIGNISSE.has(type)) return;
  try {
    let jobId = opts.jobId ?? null;
    if (!jobId && opts.applicationId) {
      const [a] = await withUser(db, userId, (tx) =>
        tx
          .select({ jobId: schema.applications.jobId })
          .from(schema.applications)
          .where(eq(schema.applications.id, opts.applicationId!))
          .limit(1),
      );
      jobId = a?.jobId ?? null;
    }
    if (!jobId) return;

    const { vorhersageFesthalten, ergebnisVermerken } = await import("./ergebnisse.ts");
    await vorhersageFesthalten(userId, jobId, opts.applicationId ?? null);
    await ergebnisVermerken(userId, jobId, type as never);

    /*
     * Der Stellenantritt plant die Check-ins.
     *
     * Auch das hängt hier, an derselben Stelle: `accepted` kann über
     * die Bewerbungsliste, über eine Zusage oder später über einen
     * anderen Weg kommen. Wer es an einen davon hängt, vergisst die
     * anderen — und eine nicht geplante Erinnerung lässt sich nicht
     * nachholen, weil der erste Tag vorbei ist.
     */
    if (type === "accepted" && opts.applicationId) {
      const { checkInsPlanen } = await import("./erinnerungen.ts");
      await checkInsPlanen(userId, opts.applicationId);
    }
  } catch (e) {
    /* Die Aufzeichnung darf die Handlung nie aufhalten. */
    console.error("[ergebnisse] Ereignis nicht verarbeitet:", e);
  }
}

export async function countSentApplications(userId: string): Promise<number> {
  const db = await getDb();
  const rows = await withUser(db, userId, (tx) =>
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.applicationEvents)
      .where(
        and(eq(schema.applicationEvents.userId, userId), eq(schema.applicationEvents.type, "application_sent")),
      ),
  );
  return rows[0]?.n ?? 0;
}

/**
 * Eine einzelne Stelle bewerten, die ausserhalb des Fensters liegt.
 *
 * Denselben Weg wie die Rangfolge, nur für eine Zeile: dieselben
 * Anforderungen, dieselben Quellen, dieselben Bewertungen. Eine
 * zweite, abweichende Bewertungslogik wäre der Anfang genau des
 * Problems, das dieses Projekt an anderen Stellen schon hatte — zwei
 * Wege, die auseinanderlaufen, und niemand weiss, welcher recht hat.
 */
async function einzelneStelleBewerten(
  userId: string,
  ctx: UserProfileContext,
  jobId: string,
): Promise<ScoredJob | null> {
  const db = await getDb();
  const [zeile] = await db
    .select({
      job: JOB_SPALTEN_SCHLANK,
      companyName: schema.companies.name,
      mitarbeiter: schema.companies.mitarbeiter,
      branche: schema.companies.industry,
      hauptsitz: schema.companies.headquarters,
    })
    .from(schema.jobs)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
    .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.isDemo, false)))
    .limit(1);
  if (!zeile) return null;

  const daten: Bestandsdaten = {
    allJobRows: [zeile],
    requirementRows: await (
      await getDb()
    )
      .select()
      .from(schema.jobRequirements)
      .where(eq(schema.jobRequirements.jobId, jobId)),
    ...(await kleineTabellen()),
  };
  const bewertet = bewerten(daten, ctx, brauchtWortmengen(ctx) ? await wortmengen(daten) : null);
  return bewertet[0] ?? null;
}
