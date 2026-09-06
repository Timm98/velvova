import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, runMigrations, type Database } from "@paycheck/db";
import { fassungsstand } from "../analyseschluessel.ts";
import { auftragAktivieren, auftragAnlegen } from "./auftrag.ts";
import { auftragslaufRunde } from "./lauf.ts";
import { zusammenfassungBauen } from "./zusammenfassung.ts";
import { durchlaufAusfuehren } from "./durchlauf.ts";
import { einbettungenNachziehen, type Einbetter, type Einbettungsmodell } from "./einbettung.ts";
import type { Prompt2 } from "./lauf.ts";

/**
 * Der Abnahmelauf aus Abschnitt 17 — eine Person, sechs Stellen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum kontrolliert und nicht auf echten Daten
 * ══════════════════════════════════════════════════════════════
 *
 * Weil sich sonst nichts prüfen lässt. Im echten Bestand tragen elf
 * von 1.215 analysierten Anzeigen Koordinaten, und keine Person hat
 * ein Profil mit belegten Fähigkeiten. Ein Lauf darüber zeigt, dass
 * nichts empfohlen wird — was stimmt und nichts über die Logik sagt.
 *
 * Hier stehen sechs Stellen mit genau den Eigenschaften, um die es
 * geht. Modell und Einbettung sind Attrappen: Diese Prüfung kostet
 * nichts und kann keinen Anbieter erreichen.
 *
 * ══════════════════════════════════════════════════════════════
 * Was die Ausgabe zeigt
 * ══════════════════════════════════════════════════════════════
 *
 * Für jede Stelle: Vorfilter, Zulässigkeit, Fit, Abdeckung,
 * Empfehlung, Grund, Vorbehalt und ob sie in die Morgen-Mail käme.
 */

let db: Database;
let close: () => Promise<void>;
let person = "";
let firma = "";
let zeitarbeitsfirma = "";
let quelle = "";
let auftragId = "";
let profilId = "";

const JETZT = new Date("2026-09-06T06:05:00Z");

/* Koordinaten für den Umkreis. Karlsruhe und Mannheim liegen rund
   55 km auseinander — Luftlinie, keine Fahrtzeit. */
const KARLSRUHE = { breite: 49.0069, laenge: 8.4037 };
const MANNHEIM = { breite: 49.4875, laenge: 8.4661 };

const MODELL: Einbettungsmodell = { name: "attrappe-embed", stapel: 16 };

async function id(q: ReturnType<typeof sql>): Promise<string> {
  const r = (await db.execute(q)) as unknown as { rows: { id: string }[] };
  return r.rows[0]!.id;
}
async function zeilen<T>(q: ReturnType<typeof sql>): Promise<T[]> {
  const r = (await db.execute(q)) as unknown as { rows: T[] };
  return r.rows;
}

interface Stellenwunsch {
  kennung: string;
  titel: string;
  ort: string;
  breite?: number | null;
  laenge?: number | null;
  arbeitsmodell?: string;
  vertrag?: string | null;
  stunden?: number | null;
  schicht?: boolean | null;
  gehalt?: number | null;
  aufgaben: string[];
  anforderungen: string[];
  text: string;
  firmaId?: string;
}

const jobIds = new Map<string, string>();

async function stelleAnlegen(s: Stellenwunsch): Promise<string> {
  const tokens = [...new Set(s.text.toLowerCase().split(/[^a-zäöüß]+/).filter((w) => w.length > 3))]
    .sort()
    .join(" ");
  const jobId = await id(sql`
    insert into jobs (title, company_id, location, country, work_model, description,
                      description_tokens, description_length, source_id, content_hash,
                      latitude, longitude, contract_type, weekly_hours, shift_work,
                      salary_min, salary_max, salary_disclosed, salary_provenance,
                      experience_level, core_tasks, published_at, fetched_at, is_demo)
    values (${s.titel}, ${(s.firmaId ?? firma)}::uuid, ${s.ort}, 'DE',
            ${s.arbeitsmodell ?? "on_site"}, ${s.text}, ${tokens}, ${s.text.length},
            ${quelle}::uuid, ${s.kennung},
            ${s.breite ?? null}, ${s.laenge ?? null},
            ${s.vertrag ?? null}, ${s.stunden ?? null}, ${s.schicht ?? null},
            ${s.gehalt ?? null}, ${s.gehalt ?? null}, ${s.gehalt !== null && s.gehalt !== undefined},
            ${s.gehalt !== null && s.gehalt !== undefined ? "provider" : null},
            'entry', ${JSON.stringify(s.aufgaben)}::jsonb, now(), now(), false)
    returning id`);

  for (const a of s.anforderungen) {
    await db.execute(sql`
      insert into job_requirements (job_id, kind, text, category)
      values (${jobId}::uuid, 'must', ${a}, 'skill')`);
  }
  await db.execute(sql`
    insert into job_analysen (job_id, eingabe_schluessel, fassung, status, extraktion,
                              bewertung, gruende, modellkonfiguration, beendet_am)
    values (${jobId}::uuid, ${`k-${jobId}`}, ${fassungsstand()}, 'fertig',
            '{"gehaltsangaben":[]}'::jsonb, '{"transparenz":60}'::jsonb, '{}'::jsonb,
            'deterministisch-v1', now())`);
  jobIds.set(s.kennung, jobId);
  return jobId;
}

/**
 * Eine Attrappe für die Einbettung.
 *
 * Sie bildet vier Themen auf vier Achsen ab. Das ist keine Semantik,
 * sondern eine kontrollierte Nachbildung davon — genug, um zu prüfen,
 * ob der Recall-Schritt findet und ob das Gefundene danach dieselbe
 * Muss-Prüfung durchläuft wie alles andere.
 */
const einbetter: Einbetter = async (texte) =>
  texte.map((t) => {
    const k = t.toLowerCase();
    const lager = /lager|kommission|stapler|logistik|versand|warenannahme/.test(k) ? 1 : 0;
    const support = /support|kunden|anfragen|ticket|beschwerde|gast|gastronomie/.test(k) ? 1 : 0;
    const buero = /buchhaltung|rechnung|controlling/.test(k) ? 1 : 0;
    const werbung = /work hard|team|obstkorb|flache hierarchien/.test(k) ? 1 : 0;
    /* Ohne Signal ein kleiner Grundwert, damit kein Nullvektor entsteht. */
    return [lager || 0.05, support, buero, werbung * 0.2];
  });

const PROMPT2: Prompt2 = { anweisung: "egal", schema: {}, fassung: "abnahme-2" };

/**
 * Eine Attrappe für Systemprompt 2.
 *
 * ══════════════════════════════════════════════════════════════
 * Was sie nachbildet
 * ══════════════════════════════════════════════════════════════
 *
 * Genau den Fall, für den es das Modell gibt: Der Code sieht bei
 * „Kommissionierer" das Wort „Lager" nur im Fliesstext und sagt
 * `teilweise`. Ein Mensch liest Kommissionierung, Warenannahme und
 * Ladungssicherung und sagt: das ist Lagerarbeit.
 *
 * Die Attrappe tut dasselbe — und beruft sich dabei auf eine
 * Anforderung der Anzeige. Ohne diese Kennung stufte
 * `matchbelegePruefen` das Urteil auf `unknown` herunter, und der
 * Code bliebe bei seinem.
 *
 * Für die Support-Stelle behauptet sie einen Transfer aus der
 * Gastronomie — und lässt den Profilbeleg weg. Das ist der zweite
 * Prüfstein: Eine Vermutung darf nicht in einen Fit einfliessen.
 */
const belegrufer = async (auftrag: { eingabe: string }) => {
  const eingabe = JSON.parse(auftrag.eingabe) as {
    kandidaten: {
      job_id: string;
      titel: string;
      aufgaben: string[];
      anforderungen: { id: string; text: string }[];
    }[];
  };

  const results = eingabe.kandidaten.map((kandidat) => {
    const kommission = kandidat.anforderungen.find((a) => /kommission/i.test(a.text));
    const kundenkontakt = kandidat.anforderungen.find((a) => /kundenkontakt/i.test(a.text));

    return {
      job_id: kandidat.job_id,
      criteria: kommission
        ? [
            {
              criterion_id: "taetigkeit",
              status: "fulfilled",
              profile_evidence_ids: [],
              job_evidence_ids: [kommission.id],
              reason: "Kommissionierung und Warenannahme sind Lagerarbeit.",
              missing_information: null,
            },
          ]
        : [],
      transferable_skill_matches: kundenkontakt
        ? [
            {
              job_requirement: "Erfahrung im Kundenkontakt",
              profile_basis: "Beschwerden von Gästen geklärt",
              /* Behauptet einen belegten Transfer — und liefert keinen
                 Profilbeleg dafür. Der Code stuft das herunter. */
              art: "transferable_skill_match",
              profile_evidence_ids: [],
              job_evidence_ids: [kundenkontakt.id],
              reason: "Beides ist Klärung im direkten Kontakt.",
            },
          ]
        : [],
      soft_hits: [],
      soft_misses: [],
      unknowns: [],
      conflicts: [],
      reason_candidates: [],
      caveat: null,
    };
  });

  return {
    data: { results } as never,
    usage: {
      inputTokens: 900,
      outputTokens: 240,
      model: "attrappe",
      provider: "attrappe",
      latencyMs: 6,
      kostenCent: 2,
    },
  };
};

beforeAll(async () => {
  const handle = await createInMemoryDb();
  db = handle.db;
  close = handle.close;
  await runMigrations(db);

  person = await id(sql`insert into users (email, display_name) values ('abnahme17@example.test', 'Mara') returning id`);
  firma = await id(sql`insert into companies (name) values ('Nordwind Logistik GmbH') returning id`);
  zeitarbeitsfirma = await id(sql`insert into companies (name) values ('Flexpersonal AG') returning id`);
  quelle = await id(sql`insert into job_sources (key, display_name, kind) values ('abnahme','Abnahme','licensed_api') returning id`);

  await db.execute(sql`insert into career_profiles (user_id, coverage, confirmed_by_user) values (${person}::uuid, 0.9, true)`);
  await db.execute(sql`
    insert into user_constraints (user_id, data)
    values (${person}::uuid, '{"country":"DE","targetCountries":[],"minSalaryPerYear":36000,"baseLocation":"Karlsruhe","maxCommuteMinutes":45}'::jsonb)`);

  /*
   * Die belegten Aussagen der Person. Alles Lager und Logistik — und
   * nichts über Kundenbetreuung. Das ist der Punkt bei Stelle C.
   */
  const belege: [string, string, string][] = [
    ["skill", "Kommissionierung und Warenannahme im Lager", "tasks_and_energy"],
    ["skill", "Staplerschein und Umgang mit Flurförderzeugen", "tasks_and_energy"],
    ["preference", "Körperliche Arbeit im Lager gibt mir Energie", "tasks_and_energy"],
    ["preference", "Ich arbeite gern im Team und packe mit an", "work_style_and_environment"],
    ["motive", "Verlässlichkeit und geregelte Arbeitszeiten", "values_and_motives"],
    ["preference", "Ich möchte mich zur Fachkraft Lagerlogistik weiterbilden", "learning_goals"],
    /*
     * Die Gastronomie-Station aus dem Auftragsbeispiel.
     *
     * Sie ist der Grund, warum die Remote-Support-Stelle überhaupt
     * gefunden wird — und der Prüfstein dafür, dass daraus keine
     * Kompetenzbehauptung wird.
     */
    ["experience_episode", "In der Gastronomie Beschwerden von Gästen geklärt und Abläufe koordiniert", "tasks_and_energy"],
  ];
  for (const [art, satz, ref] of belege) {
    await db.execute(sql`
      insert into evidence_items (user_id, type, statement, source_type, source_ref,
                                  confidence, user_confirmed, user_rejected)
      values (${person}::uuid, ${sql.raw(`'${art}'`)}, ${satz}, 'user_stated', ${ref}, 0.9, true, false)`);
  }

  /* ── Die sechs Stellen ─────────────────────────────────────── */

  await stelleAnlegen({
    kennung: "A",
    titel: "Kommissionierer (m/w/d)",
    ort: "Karlsruhe",
    breite: KARLSRUHE.breite,
    laenge: KARLSRUHE.laenge,
    vertrag: "permanent",
    stunden: 40,
    schicht: false,
    gehalt: 40000,
    aufgaben: ["Waren kommissionieren", "Warenannahme", "Ladung sichern"],
    anforderungen: ["Erfahrung in der Kommissionierung", "Staplerschein"],
    text: "Kommissionierung und Warenannahme im Lager. Unbefristet, Vollzeit, keine Schichtarbeit.",
  });

  await stelleAnlegen({
    kennung: "B",
    titel: "Lagerhelfer (m/w/d)",
    ort: "Karlsruhe",
    breite: KARLSRUHE.breite,
    laenge: KARLSRUHE.laenge,
    vertrag: "permanent",
    stunden: 40,
    schicht: null,
    gehalt: null,
    aufgaben: ["Waren einlagern", "Kommissionieren"],
    anforderungen: ["Erfahrung im Lager"],
    text: "Lagerhelfer für Einlagerung und Kommissionierung. Vollzeit.",
  });

  await stelleAnlegen({
    kennung: "C",
    titel: "Customer Support Agent (m/w/d)",
    ort: "Berlin",
    arbeitsmodell: "remote",
    vertrag: "permanent",
    stunden: 40,
    schicht: false,
    gehalt: 38000,
    aufgaben: ["Kundenanfragen bearbeiten", "Probleme erklären", "Fälle priorisieren"],
    anforderungen: ["Erfahrung im Kundenkontakt", "Sicheres Deutsch"],
    text: "Vollständig remote. Kundenanfragen bearbeiten, Probleme erklären, Tickets priorisieren.",
  });

  await stelleAnlegen({
    kennung: "D",
    titel: "Lagermitarbeiter (m/w/d)",
    ort: "Karlsruhe",
    breite: KARLSRUHE.breite,
    laenge: KARLSRUHE.laenge,
    vertrag: "temp_agency",
    stunden: 40,
    schicht: false,
    gehalt: 42000,
    aufgaben: ["Kommissionieren", "Warenannahme"],
    anforderungen: ["Erfahrung in der Kommissionierung"],
    text: "Lagerarbeit über Arbeitnehmerüberlassung. Kommissionierung und Warenannahme.",
    firmaId: zeitarbeitsfirma,
  });

  await stelleAnlegen({
    kennung: "E",
    titel: "Lagerist (m/w/d)",
    ort: "Mannheim",
    breite: MANNHEIM.breite,
    laenge: MANNHEIM.laenge,
    vertrag: "permanent",
    stunden: 40,
    schicht: false,
    gehalt: 50000,
    aufgaben: ["Kommissionieren", "Warenannahme", "Staplerfahren"],
    anforderungen: ["Erfahrung in der Kommissionierung", "Staplerschein"],
    text: "Lagerist in Mannheim. Kommissionierung, Warenannahme, Staplerfahren. Unbefristet.",
  });

  await stelleAnlegen({
    kennung: "F",
    titel: "Lagerkraft (m/w/d) — work hard play hard",
    ort: "Karlsruhe",
    breite: KARLSRUHE.breite,
    laenge: KARLSRUHE.laenge,
    vertrag: "permanent",
    stunden: null,
    schicht: null,
    gehalt: 37000,
    aufgaben: ["Kommissionieren", "Warenannahme"],
    anforderungen: ["Erfahrung in der Kommissionierung"],
    text: "Work hard play hard. Flache Hierarchien, Obstkorb, junges Team. Kommissionierung und Warenannahme im Lager.",
  });

  /* ── Der Suchauftrag ───────────────────────────────────────── */

  const befund = await auftragAnlegen(db, {
    userId: person,
    name: "Lager Karlsruhe",
    herkunft: "chat",
    kriterien: [
      { kriterium: "taetigkeit", wert: ["lager"], staerke: "muss", herkunft: "nutzer_aussage", bestaetigungsstatus: "bestaetigt" },
      { kriterium: "arbeitsort", wert: ["karlsruhe"], staerke: "muss", gruppe: "ort", herkunft: "nutzer_aussage", bestaetigungsstatus: "bestaetigt" },
      { kriterium: "arbeitsmodell", wert: ["remote"], operator: "einer_von", staerke: "muss", gruppe: "ort", herkunft: "nutzer_aussage", bestaetigungsstatus: "bestaetigt" },
      { kriterium: "wochenstunden", wert: 35, einheit: "stunden", operator: "mindestens", staerke: "muss", herkunft: "nutzer_aussage", bestaetigungsstatus: "bestaetigt" },
      { kriterium: "vertragsform", wert: ["temp_agency"], operator: "nicht", staerke: "muss", herkunft: "nutzer_aussage", bestaetigungsstatus: "bestaetigt" },
      { kriterium: "mindestgehalt", wert: 36000, einheit: "year", operator: "mindestens", staerke: "muss", herkunft: "nutzer_aussage", bestaetigungsstatus: "bestaetigt" },
      { kriterium: "schichtarbeit", wert: false, staerke: "muss", herkunft: "nutzer_aussage", bestaetigungsstatus: "bestaetigt" },
      { kriterium: "umkreis", wert: { ...KARLSRUHE, km: 30, ort: "Karlsruhe" }, staerke: "wunsch", herkunft: "nutzer_aussage", bestaetigungsstatus: "bestaetigt" },
    ],
  });
  auftragId = befund.auftragId;
  profilId = befund.profilId;
  await auftragAktivieren(db, person, auftragId, JETZT);
}, 180_000);

afterAll(async () => {
  await close?.();
});

interface Befund {
  titel: string;
  zulaessigkeit: string;
  empfehlungsstatus: string;
  fit_score: number | null;
  fit_abdeckung: number | null;
  gruende: string[];
  offene_punkte: string[];
  caveat: string | null;
  kriterien_ergebnisse: { kriterium: string; status: string; begruendung: string }[];
}

async function befunde(): Promise<Map<string, Befund>> {
  const zeilen0 = await zeilen<Befund & { job_id: string }>(sql`
    select j.title as titel, t.zulaessigkeit, t.empfehlungsstatus, t.fit_score, t.fit_abdeckung,
           t.gruende, t.offene_punkte, t.caveat, t.kriterien_ergebnisse, t.job_id
      from auftrag_treffer t join jobs j on j.id = t.job_id
     where t.auftrag_id = ${auftragId}::uuid`);
  const nachKennung = new Map<string, Befund>();
  for (const [kennung, jobId] of jobIds) {
    const z = zeilen0.find((x) => x.job_id === jobId);
    if (z) nachKennung.set(kennung, z);
  }
  return nachKennung;
}

describe("Abschnitt 17 · sechs Stellen, eine Person", () => {
  let alle: Map<string, Befund>;

  it("führt die Runde aus und legt für jede Stelle einen Befund ab", async () => {
    /* Ohne Vektoren kein semantischer Schritt. Im Betrieb zieht der
       Durchlauf sie nach; hier steht der Schritt einzeln. */
    const eingebettet = await einbettungenNachziehen(db, MODELL, einbetter);
    expect(eingebettet.neu).toBeGreaterThan(0);

    const lauf = await auftragslaufRunde(
      db,
      {
        id: auftragId,
        userId: person,
        name: "Lager Karlsruhe",
        status: "aktiv",
        geltungsbereich: {},
        aktiveProfilVersion: profilId,
      },
      {
        jetzt: JETZT,
        /*
         * Die Schwelle wird gesenkt. 70 von 100 ist eine
         * Produktentscheidung; hier geht es um die Mechanik, und die
         * braucht eine Empfehlung, um sichtbar zu werden.
         */
        schwelle: 40,
        einbetter,
        einbettungsmodell: MODELL,
        prompt2: PROMPT2,
        rufer: belegrufer as never,
      },
    );
    expect(lauf.geprueft).toBeGreaterThanOrEqual(5);

    alle = await befunde();

    /* Die Tabelle für den Bericht. */
    const zeile = (kennung: string) => {
      const b = alle.get(kennung);
      if (!b) return `${kennung}  — nicht im Kandidatenpool`;
      return [
        kennung,
        b.titel.slice(0, 34).padEnd(34),
        b.zulaessigkeit.padEnd(20),
        String(b.fit_score ?? "—").padStart(4),
        (b.fit_abdeckung === null ? "—" : b.fit_abdeckung.toFixed(2)).padStart(5),
        b.empfehlungsstatus.padEnd(16),
      ].join(" ");
    };
    // eslint-disable-next-line no-console
    console.log(
      "\n" +
        ["  Titel                              Zulässigkeit          Fit  Abd. Empfehlung", ...["A", "B", "C", "D", "E", "F"].map(zeile)].join(
          "\n",
        ),
    );
    for (const k of ["A", "B", "C", "D", "E", "F"]) {
      const b = alle.get(k);
      if (!b) continue;
      // eslint-disable-next-line no-console
      console.log(
        `\n${k}: ${b.titel}\n   Gründe: ${b.gruende.join(" / ") || "—"}` +
          `\n   Offen:  ${b.offene_punkte.join(", ") || "—"}` +
          `\n   Caveat: ${b.caveat ?? "—"}` +
          `\n   ${b.kriterien_ergebnisse.map((r) => `${r.kriterium}=${r.status}`).join(" · ")}`,
      );
    }
  });

  it("A · Kommissionierer Karlsruhe ist zulässig", () => {
    /*
     * Der Code allein sagt `teilweise`: „Lager" steht nur im
     * Fliesstext. Das Modell erkennt Kommissionierung und
     * Warenannahme als Lagerarbeit — und beruft sich auf eine
     * Anforderung der Anzeige. Ohne diese Kennung bliebe es beim
     * Urteil des Codes.
     */
    const a = alle.get("A")!;
    const taetigkeit = a.kriterien_ergebnisse.find((r) => r.kriterium === "taetigkeit")!;
    expect(taetigkeit.status).toBe("erfuellt");
    expect(taetigkeit.begruendung).toContain("Lagerarbeit");
    expect(a.zulaessigkeit).toBe("eligible");
    expect(a.fit_score).not.toBeNull();
  });

  it("C · eine unbelegte Vermutung wird kein Grund", () => {
    /*
     * Die Attrappe behauptet einen belegten Transfer aus der
     * Gastronomie und liefert keinen Profilbeleg. Er darf nicht als
     * Grund erscheinen — nur als offener Punkt.
     */
    const c = alle.get("C")!;
    expect(c.gruende.join(" ")).not.toContain("Klärung im direkten Kontakt");
    expect(c.offene_punkte.join(" ")).toContain("Möglicher Übergang");
  });

  it("B · fehlendes Gehalt bleibt ungeklärt, nicht erfüllt", () => {
    const b = alle.get("B")!;
    const gehalt = b.kriterien_ergebnisse.find((r) => r.kriterium === "mindestgehalt")!;
    expect(gehalt.status).toBe("unbekannt");
    expect(b.zulaessigkeit).toBe("needs_clarification");
    /* Kein vollständig bestätigter Morgen-Mail-Match. */
    expect(b.empfehlungsstatus).not.toBe("empfohlen");
  });

  it("C · Remote-Support: Standort erfüllt, Tätigkeit nicht", () => {
    const c = alle.get("C");
    /* Er darf gefunden werden — über den semantischen Schritt. */
    if (!c) return;
    const ort = c.kriterien_ergebnisse.find((r) => r.kriterium === "arbeitsmodell")!;
    expect(ort.status).toBe("erfuellt");
    const taetigkeit = c.kriterien_ergebnisse.find((r) => r.kriterium === "taetigkeit")!;
    /*
     * Semantische Ähnlichkeit hat ihn gefunden. Sie erfüllt kein
     * Kriterium: „Customer Support" ist kein Lager.
     */
    expect(taetigkeit.status).not.toBe("erfuellt");
    expect(c.empfehlungsstatus).not.toBe("empfohlen");
  });

  it("D · Zeitarbeit ist ein Ausschluss", () => {
    const d = alle.get("D")!;
    const vertrag = d.kriterien_ergebnisse.find((r) => r.kriterium === "vertragsform")!;
    expect(vertrag.status).toBe("nicht_erfuellt");
    expect(d.zulaessigkeit).toBe("ineligible");
    expect(d.empfehlungsstatus).toBe("ausgeschlossen");
  });

  it("E · Mannheim liegt ausserhalb und ist nicht remote", () => {
    const e = alle.get("E")!;
    expect(e.zulaessigkeit).toBe("ineligible");
    const umkreis = e.kriterien_ergebnisse.find((r) => r.kriterium === "umkreis")!;
    /* 55 km Luftlinie bei 30 km Umkreis. */
    expect(umkreis.status).toBe("nicht_erfuellt");
    expect(umkreis.begruendung).toContain("km");
  });

  it("F · keine erfundene Aussage über Arbeitszeit", () => {
    const f = alle.get("F")!;
    const stunden = f.kriterien_ergebnisse.find((r) => r.kriterium === "wochenstunden")!;
    expect(stunden.status).toBe("unbekannt");
    /*
     * „Work hard play hard" ist Werbung, keine Angabe. Nichts in der
     * Begründung darf über unbezahlte Überstunden sprechen — die
     * Anzeige sagt dazu nichts.
     */
    const alleTexte = [...f.gruende, f.caveat ?? "", ...f.kriterien_ergebnisse.map((r) => r.begruendung)].join(" ");
    expect(alleTexte.toLowerCase()).not.toContain("überstunden");
    expect(f.zulaessigkeit).toBe("needs_clarification");
  });

  it("nur zulässige Stellen kommen in die Morgen-Mail", async () => {
    const befund = await zusammenfassungBauen(db, person, {
      jetzt: JETZT,
      basisUrl: "https://velvova.test",
    });

    const posten = await zeilen<{ titel: string }>(sql`
      select j.title as titel from zusammenfassung_posten p join jobs j on j.id = p.job_id
       where p.zusammenfassung_id = ${befund.zusammenfassungId}::uuid`);
    // eslint-disable-next-line no-console
    console.log(
      `\nMorgen-Mail: ${posten.length} Posten — ${posten.map((p) => p.titel).join(", ") || "keine"}` +
        `${befund.uebersprungen ? ` (übersprungen: ${befund.uebersprungen})` : ""}`,
    );

    /* Zeitarbeit und Mannheim tauchen nirgends auf. */
    expect(posten.some((p) => p.titel.includes("Lagermitarbeiter"))).toBe(false);
    expect(posten.some((p) => p.titel.includes("Lagerist"))).toBe(false);
    /* Und die mit ungeklärtem Gehalt auch nicht. */
    expect(posten.some((p) => p.titel.includes("Lagerhelfer"))).toBe(false);
  });
});

describe("Abschnitt 17 · die ganze Kette", () => {
  it("läuft von der Fälligkeit bis zur fertigen Mail", async () => {
    /* Eine zweite Person, damit das Fenster frei ist. */
    const zweite = await id(sql`insert into users (email, display_name) values ('kette@example.test', 'Jonas') returning id`);
    await db.execute(sql`insert into career_profiles (user_id, coverage, confirmed_by_user) values (${zweite}::uuid, 0.9, true)`);
    await db.execute(sql`
      insert into user_constraints (user_id, data)
      values (${zweite}::uuid, '{"country":"DE","targetCountries":[],"minSalaryPerYear":36000,"baseLocation":"Karlsruhe","maxCommuteMinutes":45}'::jsonb)`);
    for (const [art, satz, ref] of [
      ["skill", "Kommissionierung und Warenannahme im Lager", "tasks_and_energy"],
      ["preference", "Körperliche Arbeit gibt mir Energie", "tasks_and_energy"],
      ["preference", "Ich arbeite gern im Team", "work_style_and_environment"],
      ["motive", "Verlässlichkeit", "values_and_motives"],
      ["preference", "Weiterbildung zur Fachkraft", "learning_goals"],
    ] as const) {
      await db.execute(sql`
        insert into evidence_items (user_id, type, statement, source_type, source_ref, confidence, user_confirmed)
        values (${zweite}::uuid, ${sql.raw(`'${art}'`)}, ${satz}, 'user_stated', ${ref}, 0.9, true)`);
    }
    await db.execute(sql`
      insert into benachrichtigung_einstellungen (user_id, email_aktiv, email_adresse, adresse_bestaetigt_am)
      values (${zweite}::uuid, true, 'kette@example.test', now())`);

    const auftrag = await auftragAnlegen(db, {
      userId: zweite,
      name: "Kette",
      kriterien: [
        { kriterium: "taetigkeit", wert: ["lager"], staerke: "muss", herkunft: "nutzer_aussage", bestaetigungsstatus: "bestaetigt" },
        { kriterium: "mindestgehalt", wert: 36000, einheit: "year", operator: "mindestens", staerke: "muss", herkunft: "nutzer_aussage", bestaetigungsstatus: "bestaetigt" },
      ],
    });
    await auftragAktivieren(db, zweite, auftrag.auftragId, JETZT);
    await db.execute(sql`
      update such_auftraege set naechste_faelligkeit = ${new Date(JETZT.getTime() - 60_000).toISOString()}
       where id = ${auftrag.auftragId}::uuid`);

    const versendet: { an: string; betreff: string; text: string }[] = [];
    const bericht = await durchlaufAusfuehren(db, {
      jetzt: JETZT,
      basisUrl: "https://velvova.test",
      kandidaten: 30,
      /* Wie oben: Die Schwelle ist eine Produktentscheidung; hier
         geht es um die Mechanik dahinter. */
      schwelle: 40,
      einbetter,
      einbettungsmodell: MODELL,
      rufer: belegrufer as never,
      prompt2: PROMPT2,
      versender: async (a) => {
        versendet.push({ an: a.an, betreff: a.betreff, text: a.text });
        return { ok: true, anbieterId: "kette-1", anbieter: "attrappe" };
      },
    });

    // eslint-disable-next-line no-console
    console.log(
      `\nKette — fällig ${bericht.faellig} · eingebettet ${bericht.einbettungen.neu}` +
        ` · geprüft ${bericht.auftraege[0]?.geprueft ?? 0}` +
        ` · semantisch ${bericht.auftraege[0]?.semantisch ?? 0}` +
        ` · empfohlen ${bericht.auftraege[0]?.empfohlen ?? 0}` +
        ` · Zusammenfassung ${bericht.zusammenfassungen[0]?.posten ?? 0} Posten` +
        ` · versendet ${versendet.length}`,
    );
    if (versendet[0]) {
      // eslint-disable-next-line no-console
      console.log(`\nMailvorschau:\n${versendet[0].text.split("\n").slice(0, 14).join("\n")}`);
    }

    expect(bericht.faellig).toBe(1);
    /*
     * Nichts neu eingebettet — die Vektoren aus dem ersten Lauf
     * gelten weiter. Genau dafür steht der Fingerabdruck des Textes
     * daneben: Ein Vektor hängt am Text, nicht am Datum.
     */
    expect(bericht.einbettungen.neu).toBe(0);
    /* Und die Kette läuft bis zur fertigen Mail durch. */
    expect(versendet).toHaveLength(1);
    /*
     * Der zweite Auftrag nennt nur Tätigkeit und Gehalt — er
     * schliesst Zeitarbeit nicht aus. Dass die Zeitarbeitsstelle hier
     * auftaucht und beim ersten Auftrag nicht, ist kein Fehler,
     * sondern der Unterschied zwischen zwei Suchaufträgen.
     */
    expect(versendet[0]!.text).toContain("Lager");
    expect(versendet[0]!.an).toBe("kette@example.test");
    /* Die Anrede kommt aus `display_name`, nicht aus der Adresse. */
    expect(versendet[0]!.text.startsWith("Hallo Jonas,")).toBe(true);
  });
});
