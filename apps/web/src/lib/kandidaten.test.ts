import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, runMigrations, schema, type Database } from "@paycheck/db";
import { UserConstraintsSchema } from "@paycheck/domain";
import { beschreibungsTokens } from "@paycheck/matching";
import { brauchtReihenfolge, kandidatenBedingung, KANDIDATEN_REIHENFOLGE } from "./kandidaten.ts";

/**
 * Welche Stellen die Datenbank zur Bewertung durchlässt.
 *
 * ── Warum das die heikelste Stelle des Umbaus ist ─────────────
 *
 * Bewertet wird nicht mehr der ganze Bestand, sondern eine Vorauswahl.
 * Filtert sie zu scharf, verschwinden Stellen aus der Liste, die die
 * Bedingungsprüfung durchgelassen hätte — und **niemand sieht es**,
 * weil eine kürzere Liste wie eine vollständige aussieht.
 *
 * Die Regel lautet deshalb: Ausgeschlossen wird nur, was
 * **nachweislich** widerspricht. `checkConstraints` kennt drei
 * Ausgänge und stuft „unklar" bewusst nie zu „blockiert" hoch — eine
 * Anzeige, die nichts zum Gehalt sagt, verletzt keine Untergrenze.
 * Diese Vorauswahl muss dieselbe Zurückhaltung haben.
 *
 * Geprüft gegen echtes Postgres, weil die Regel in SQL steht.
 */

let db: Database;
let close: () => Promise<void>;
let firma: string;
let quelle: string;

const LEER = UserConstraintsSchema.parse({
  minSalaryPerYear: null,
  baseLocation: null,
  maxCommuteMinutes: null,
  weeklyHoursMin: null,
  weeklyHoursMax: null,
  maxTravelPercent: null,
});

async function stelle(over: Record<string, unknown>) {
  const [j] = await db
    .insert(schema.jobs)
    .values({
      title: "Probe",
      companyId: firma,
      sourceId: quelle,
      location: "Karlsruhe",
      country: "DE",
      workModel: "on_site",
      description: "Eine Beschreibung mit genug Text für eine Anzeige.",
      descriptionTokens: beschreibungsTokens("Eine Beschreibung mit genug Text."),
      descriptionLength: 48,
      contentHash: randomUUID(),
      ...over,
    } as never)
    .returning({ id: schema.jobs.id, title: schema.jobs.title });
  return j!;
}

async function durchgelassenMitSuche(suche: string): Promise<string[]> {
  const zeilen = await db
    .select({ titel: schema.jobs.title })
    .from(schema.jobs)
    .where(kandidatenBedingung(LEER, suche))
    .orderBy(KANDIDATEN_REIHENFOLGE);
  return zeilen.map((z) => z.titel);
}

async function durchgelassen(c = LEER): Promise<string[]> {
  const zeilen = await db
    .select({ titel: schema.jobs.title })
    .from(schema.jobs)
    .where(kandidatenBedingung(c))
    .orderBy(KANDIDATEN_REIHENFOLGE);
  return zeilen.map((z) => z.titel);
}

async function durchgelassenMitOrt(ort: string): Promise<string[]> {
  const zeilen = await db
    .select({ titel: schema.jobs.title })
    .from(schema.jobs)
    .where(kandidatenBedingung(LEER, { ort }))
    .orderBy(KANDIDATEN_REIHENFOLGE);
  return zeilen.map((z) => z.titel);
}

beforeAll(async () => {
  const handle = await createInMemoryDb();
  db = handle.db;
  close = handle.close;
  await runMigrations(db);
  const [f] = await db.insert(schema.companies).values({ name: "Muster GmbH" }).returning();
  const [q] = await db
    .insert(schema.jobSources)
    .values({ key: "t", displayName: "Testquelle", kind: "seed" })
    .returning();
  firma = f!.id;
  quelle = q!.id;
}, 180_000);

afterAll(async () => {
  await close?.();
});

describe("Ohne Bedingungen", () => {
  it("lässt alles durch ausser Demo-Daten", async () => {
    await stelle({ title: "Echt" });
    await stelle({ title: "Demo", isDemo: true });
    const raus = await durchgelassen();
    expect(raus).toContain("Echt");
    expect(raus).not.toContain("Demo");
  });
});

describe("Arbeitsmodell", () => {
  it("schliesst aus, was die Person ausgeschlossen hat", async () => {
    await stelle({ title: "Vor Ort", workModel: "on_site" });
    await stelle({ title: "Remote", workModel: "remote" });
    const c = UserConstraintsSchema.parse({ ...LEER, acceptedWorkModels: ["remote"] });
    const raus = await durchgelassen(c);
    expect(raus).toContain("Remote");
    expect(raus).not.toContain("Vor Ort");
  });

  it("schränkt nicht ein, wenn alle drei erlaubt sind", async () => {
    // Die Voreinstellung. Eine Liste mit allen möglichen Werten wäre
    // nur langsamer und würde nichts filtern.
    const c = UserConstraintsSchema.parse({
      ...LEER,
      acceptedWorkModels: ["remote", "hybrid", "on_site"],
    });
    const raus = await durchgelassen(c);
    expect(raus).toContain("Vor Ort");
    expect(raus).toContain("Remote");
  });
});

describe("Gehalt — nur nachgewiesene Unterschreitungen", () => {
  it("schliesst eine zu niedrige, vom Arbeitgeber genannte Angabe aus", async () => {
    await stelle({
      title: "Zu wenig",
      salaryMin: 30000,
      salaryMax: 35000,
      salaryPeriod: "year",
      salaryDisclosed: true,
    });
    const c = UserConstraintsSchema.parse({ ...LEER, minSalaryPerYear: 45000 });
    expect(await durchgelassen(c)).not.toContain("Zu wenig");
  });

  it("lässt eine Stelle ohne Gehaltsangabe drin", async () => {
    /*
     * Der Kern der Sache. Eine Anzeige, die nichts zum Gehalt sagt,
     * verletzt keine Untergrenze — sie ist „unklar", und `uncertain`
     * wird nie zu `blocked`. Filterte die Datenbank sie weg,
     * verschwänden Zehntausende Stellen lautlos aus jeder Liste, in
     * der jemand eine Gehaltsgrenze gesetzt hat.
     */
    await stelle({ title: "Kein Gehalt genannt" });
    const c = UserConstraintsSchema.parse({ ...LEER, minSalaryPerYear: 45000 });
    expect(await durchgelassen(c)).toContain("Kein Gehalt genannt");
  });

  it("lässt eine aus dem Text gelesene Angabe drin", async () => {
    // `disclosed: false` heisst: nicht der Arbeitgeber hat es gesagt,
    // sondern wir haben es gelesen. Darauf wird niemand ausgeschlossen.
    await stelle({
      title: "Aus dem Text",
      salaryMin: 30000,
      salaryMax: 32000,
      salaryPeriod: "year",
      salaryDisclosed: false,
    });
    const c = UserConstraintsSchema.parse({ ...LEER, minSalaryPerYear: 45000 });
    expect(await durchgelassen(c)).toContain("Aus dem Text");
  });

  it("rechnet Monats- und Stundenangaben aufs Jahr", async () => {
    /*
     * Dieselben Faktoren wie `normaliseSalaryToYear`: mal zwölf, und
     * bei Stundenlohn mal 40 mal 52. Rechnete die Datenbank anders,
     * verschwänden Stellen, die die Prüfung durchlässt — oder
     * umgekehrt.
     */
    await stelle({
      title: "5000 im Monat",
      salaryMin: 5000,
      salaryMax: 5000,
      salaryPeriod: "month",
      salaryDisclosed: true,
    });
    await stelle({
      title: "10 die Stunde",
      salaryMin: 10,
      salaryMax: 10,
      salaryPeriod: "hour",
      salaryDisclosed: true,
    });
    const c = UserConstraintsSchema.parse({ ...LEER, minSalaryPerYear: 45000 });
    const raus = await durchgelassen(c);
    expect(raus).toContain("5000 im Monat"); // 60.000 im Jahr
    expect(raus).not.toContain("10 die Stunde"); // 20.800 im Jahr
  });

  it("nimmt die Obergrenze der Spanne, nicht die untere", async () => {
    // „Erreicht sie das Minimum, ist Verhandlung möglich" —
    // dieselbe Regel wie in `checkConstraints`.
    await stelle({
      title: "Spanne trifft oben",
      salaryMin: 40000,
      salaryMax: 50000,
      salaryPeriod: "year",
      salaryDisclosed: true,
    });
    const c = UserConstraintsSchema.parse({ ...LEER, minSalaryPerYear: 45000 });
    expect(await durchgelassen(c)).toContain("Spanne trifft oben");
  });
});

describe("Reihenfolge", () => {
  it("nimmt die neuesten zuerst", async () => {
    await stelle({ title: "Alt", publishedAt: new Date("2020-01-01") });
    await stelle({ title: "Neu", publishedAt: new Date("2030-01-01") });
    const raus = await durchgelassen();
    expect(raus.indexOf("Neu")).toBeLessThan(raus.indexOf("Alt"));
  });
});

describe("Der Suchbegriff", () => {
  /**
   * ── Warum er in die Auswahl gehört, nicht dahinter ────────
   *
   * Bewertet werden 2.000 Stellen statt 823.429 — sonst stirbt der
   * Server am Arbeitsspeicher. Ohne Suchbegriff sind das die
   * neuesten, und dann steckt von einem bestimmten Beruf fast nichts
   * drin. Gemessen am echten Bestand:
   *
   *   Zerspanungsmechaniker  2.907 vorhanden ·  14 in der Auswahl
   *   Erzieher               2.739 vorhanden ·   4
   *   Data Engineer            996 vorhanden ·   0
   *
   * Wer suchte, bekam eine leere Liste. Und die sieht aus wie ein
   * leerer Arbeitsmarkt, nicht wie ein Fehler — die teuerste Sorte
   * Defekt, weil niemand ihn meldet.
   */
  it("findet einen Beruf im Titel", async () => {
    await stelle({ title: "Data Engineer (m/w/d)" });
    await stelle({ title: "Bäcker (m/w/d)" });
    const raus = await durchgelassenMitSuche("data engineer");
    expect(raus).toContain("Data Engineer (m/w/d)");
    expect(raus).not.toContain("Bäcker (m/w/d)");
  });

  it("findet einen Ort, der in keinem Titel steht", async () => {
    /*
     * „Bayern" steht in keinem Stellentitel — es ist ein Ort. Ohne den
     * zweiten Index fände die Suche danach nichts, und genau danach
     * suchen Menschen zuerst.
     *
     * `simple` statt `german`: Ortsnamen werden nicht gestemmt. Der
     * deutsche Stemmer führte sonst Orte zusammen, die nichts
     * miteinander zu tun haben.
     */
    await stelle({ title: "Lagerhelfer (m/w/d)", location: "München, Bayern" });
    await stelle({ title: "Bäcker (m/w/d)", location: "Hamburg" });
    const raus = await durchgelassenMitSuche("bayern");
    expect(raus).toContain("Lagerhelfer (m/w/d)");
    expect(raus).not.toContain("Bäcker (m/w/d)");
  });

  it("findet NICHT mehr, was nur in der Beschreibung steht", async () => {
    /*
     * ══════════════════════════════════════════════════════════════
     * Was der Geschwindigkeit geopfert wurde — und warum
     * ══════════════════════════════════════════════════════════════
     *
     * Vorher wurde die Wortmenge der Beschreibung mitdurchsucht. Das
     * fand Stellen, deren Titel das Wort nicht trägt — „Mitarbeiter
     * (m/w/d)" für eine Lagerstelle.
     *
     * Es geschah mit `description_tokens like '%…%'`. Ein führendes
     * Prozentzeichen ist von keinem Index bedienbar: Postgres las die
     * ganze Tabelle. Gemessen am 6. September 2026 an 2.599.863
     * Zeilen lief die Suche in den Statement-Timeout — die Seite
     * antwortete mit HTTP 500.
     *
     * Eine Suche, die nichts findet, weil sie abbricht, ist schlechter
     * als eine, die weniger findet.
     *
     * ── Was es wiederbrächte ────────────────────────────────────
     *
     * Ein GIN-Index auf `to_tsvector('german', description_tokens)`.
     * Er kostet bei diesem Bestand ein bis drei Gigabyte und braucht
     * einen Lauf mit `concurrently`. Das ist eine Entscheidung über
     * Speicherplatz, keine Reparatur — deshalb steht sie hier als
     * Notiz und nicht als Migration.
     */
    await stelle({
      title: "Mitarbeiter (m/w/d)",
      descriptionTokens: "lagerlogistik kommissionierung gabelstapler",
    });
    expect(await durchgelassenMitSuche("gabelstapler")).not.toContain("Mitarbeiter (m/w/d)");
  });

  it("verlangt alle Wörter, nicht irgendeines", async () => {
    // „Senior Data" soll nicht jede Stelle finden, in der irgendwo
    // „Senior" steht.
    await stelle({ title: "Senior Data Engineer" });
    await stelle({ title: "Senior Koch" });
    const raus = await durchgelassenMitSuche("senior data");
    expect(raus).toContain("Senior Data Engineer");
    expect(raus).not.toContain("Senior Koch");
  });

  it("achtet nicht auf Gross- und Kleinschreibung", async () => {
    await stelle({ title: "Steuerberater (m/w/d)" });
    expect(await durchgelassenMitSuche("STEUERBERATER")).toContain("Steuerberater (m/w/d)");
  });

  it("ignoriert einen leeren oder zu kurzen Begriff", async () => {
    // Sonst filterte ein versehentliches Leerzeichen alles weg.
    const alle = await durchgelassen();
    expect((await durchgelassenMitSuche("   ")).length).toBe(alle.length);
    expect((await durchgelassenMitSuche("")).length).toBe(alle.length);
  });
});

describe("Land als harte Bedingung", () => {
  /**
   * Der Karlsruhe-Fehler.
   *
   * Wer in Karlsruhe suchte, bekam Stellen aus Christchurch. Nicht
   * weil die Ortssuche falsch rechnete, sondern weil die Kandidaten
   * aus dem gesamten Weltbestand gezogen wurden — 1,7 Millionen
   * Anzeigen aus 19 Ländern, ohne eine Zeile, die das einschränkt.
   *
   * `UserConstraints` führt `country` seit dem ersten Entwurf. Benutzt
   * hat es hier nie jemand.
   */
  beforeAll(async () => {
    await stelle({ title: "Karlsruhe DE", location: "Karlsruhe", country: "DE" });
    await stelle({ title: "Christchurch NZ", location: "Christchurch, Canterbury", country: "NZ" });
    await stelle({ title: "Wien AT", location: "Wien", country: "AT" });
  });

  it("lässt Neuseeland für jemanden in Deutschland nicht durch", async () => {
    const titel = await durchgelassen({ ...LEER, country: "DE" });
    expect(titel).toContain("Karlsruhe DE");
    expect(titel).not.toContain("Christchurch NZ");
    expect(titel).not.toContain("Wien AT");
  });

  it("nimmt genannte Zielländer dazu", async () => {
    const titel = await durchgelassen({ ...LEER, country: "DE", targetCountries: ["AT"] });
    expect(titel).toContain("Karlsruhe DE");
    expect(titel).toContain("Wien AT");
    expect(titel).not.toContain("Christchurch NZ");
  });

  it("schränkt nicht ein, wenn niemand ein Land genannt hat", async () => {
    /*
     * ══════════════════════════════════════════════════════════════
     * Kein Land gesagt heisst überall — nicht heisst Deutschland
     * ══════════════════════════════════════════════════════════════
     *
     * `country` hatte `"DE"` als Vorgabe im Schema. Damit bekam jeder,
     * der nie etwas eingetragen hat, ausschliesslich deutsche Stellen:
     * 998 von 1.024 Konten, gemessen am 6. September 2026.
     *
     * Für jemanden in Wien oder Zürich war das kein Standard, sondern
     * ein leerer Arbeitsmarkt mit falscher Erklärung — und nichts auf
     * der Seite sagte, woran es lag.
     */
    const titel = await durchgelassen({ ...LEER, country: null });
    expect(titel).toContain("Karlsruhe DE");
    expect(titel).toContain("Wien AT");
    expect(titel).toContain("Christchurch NZ");
  });

  it("nimmt Österreich und die Schweiz wie jedes andere Land", async () => {
    const titel = await durchgelassen({ ...LEER, country: "AT" });
    expect(titel).toContain("Wien AT");
    expect(titel).not.toContain("Karlsruhe DE");
  });

  it("öffnet nicht allein wegen Umzugsbereitschaft", async () => {
    /*
     * Umzugsbereitschaft ohne genanntes Zielland ist keine Erlaubnis
     * für neunzehn Länder. Wer nach Österreich will, trägt Österreich
     * ein.
     */
    const titel = await durchgelassen({ ...LEER, country: "DE", willingToRelocate: true });
    expect(titel).not.toContain("Christchurch NZ");
  });
});

describe("Der Ort", () => {
  it("filtert in der Datenbank, nicht erst danach", async () => {
    /*
     * Vorher lieferte die Abfrage die neuesten 2.000 Anzeigen
     * bundesweit, und erst JavaScript behielt die aus Karlsruhe. Bei
     * „Bayern" blieb davon fast nichts übrig.
     */
    /* Ein Ort, den keine andere Probe in dieser Datei benutzt —
       die Vorgabe der Testdaten ist Karlsruhe. */
    await stelle({ title: "Lagerhelfer Flensburg (m/w/d)", location: "Flensburg" });
    await stelle({ title: "Lagerhelfer Passau (m/w/d)", location: "Passau" });

    const raus = await durchgelassenMitOrt("flensburg");
    expect(raus).toEqual(["Lagerhelfer Flensburg (m/w/d)"]);
  });

  it("findet einen Ort, der nur als Teil der Angabe dasteht", async () => {
    /*
     * Die Berliner Anzeigen stehen überwiegend als „Wedding, Berlin"
     * oder „Mitte, Berlin". Ein Präfix verlöre sie; die Wortsuche
     * findet sie — und nimmt „Überlingen" nicht mit.
     */
    await stelle({ title: "Koch (m/w/d)", location: "Wedding, Berlin" });
    await stelle({ title: "Koch (m/w/d)", location: "Überlingen" });

    const raus = await durchgelassenMitOrt("berlin");
    expect(raus).toHaveLength(1);
  });
});

describe("Das Zeitfenster der Textsuche", () => {
  it("lässt eine alte Anzeige ohne Suchbegriff durch", async () => {
    const alt = new Date(Date.now() - 60 * 86_400_000);
    await stelle({ title: "Alte Stelle ohne Suche", publishedAt: alt, fetchedAt: alt });
    expect(await durchgelassen()).toContain("Alte Stelle ohne Suche");
  });

  it("lässt sie bei einer Textsuche nicht mehr durch", async () => {
    /*
     * Das Fenster ersetzt die Sortierung, die bei einer
     * Textbedingung nicht mehr bezahlbar ist: „Berlin" sortiert
     * kostete gemessen 37 Sekunden, mit Fenster und ohne Sortierung
     * 131 Millisekunden.
     *
     * Was dabei wegfällt, ist eine Anzeige von vor zwei Monaten —
     * und die ist ohnehin meistens weg.
     */
    const alt = new Date(Date.now() - 60 * 86_400_000);
    await stelle({
      title: "Uraltes Lagerangebot",
      location: "Husum",
      publishedAt: alt,
      fetchedAt: alt,
    });
    await stelle({ title: "Frisches Lagerangebot", location: "Husum" });

    const raus = await durchgelassenMitOrt("husum");
    expect(raus).toContain("Frisches Lagerangebot");
    expect(raus).not.toContain("Uraltes Lagerangebot");
  });

  it("weiss, wann sortiert werden muss", async () => {
    expect(brauchtReihenfolge(null)).toBe(true);
    expect(brauchtReihenfolge({ suche: null, ort: null })).toBe(true);
    expect(brauchtReihenfolge({ ort: "berlin" })).toBe(false);
    expect(brauchtReihenfolge("lagerhelfer")).toBe(false);
  });
});

