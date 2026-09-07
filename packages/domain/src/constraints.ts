import { z } from "zod";

/**
 * Harte Bedingungen des Menschen. Sie werden vor jedem Score geprüft und
 * niemals stillschweigend aufgeweicht - auch nicht, wenn eine Stelle sonst
 * hervorragend passt.
 */

export const WorkModelSchema = z.enum(["on_site", "hybrid", "remote"]);
export type WorkModel = z.infer<typeof WorkModelSchema>;

export const ContractTypeSchema = z.enum([
  "permanent", "fixed_term", "internship", "working_student",
  "apprenticeship", "freelance", "temp_agency",
]);
export type ContractType = z.infer<typeof ContractTypeSchema>;

export const CommuteModeSchema = z.enum(["walk", "bike", "public_transport", "car"]);
export type CommuteMode = z.infer<typeof CommuteModeSchema>;

export const UserConstraintsSchema = z.object({
  /** Untergrenze brutto pro Jahr in der Währung des Landes. */
  minSalaryPerYear: z.number().int().nonnegative().nullable(),
  currency: z.string().length(3).default("EUR"),
  /** Was einen niedrigeren Betrag ausnahmsweise ausgleichen könnte. */
  salaryTradeOffs: z.array(z.string()).default([]),

  baseLocation: z.string().nullable(),
  /**
   * Das Land, in dem gesucht wird — oder `null`.
   *
   * ══════════════════════════════════════════════════════════════
   * Warum hier keine Vorgabe mehr steht
   * ══════════════════════════════════════════════════════════════
   *
   * Es stand `.default("DE")`. Das sah harmlos aus und war eine
   * stille Entscheidung über jeden, der nie ein Land eingetragen hat:
   * Gemessen am 6. September 2026 hatten 998 von 1.024 Konten keine
   * eigene Bedingungszeile — sie alle bekamen ausschliesslich
   * deutsche Stellen, ohne es zu erfahren.
   *
   * Für jemanden in Wien oder Zürich ist das keine Voreinstellung,
   * sondern ein leerer Arbeitsmarkt mit falscher Erklärung.
   *
   * `null` heisst jetzt: nicht gesagt. Die Suche schränkt dann nicht
   * ein — und Monday fragt, sobald es einen Anlass gibt. Eine offene
   * Frage ist ehrlicher als eine geratene Antwort.
   */
  country: z.string().length(2).nullable().default(null),
  maxCommuteMinutes: z.number().int().positive().nullable(),
  commuteMode: CommuteModeSchema.default("public_transport"),
  acceptedWorkModels: z.array(WorkModelSchema).default(["on_site", "hybrid", "remote"]),
  willingToRelocate: z.boolean().default(false),
  targetCountries: z.array(z.string().length(2)).default([]),

  weeklyHoursMin: z.number().int().positive().nullable(),
  weeklyHoursMax: z.number().int().positive().nullable(),
  acceptsShiftWork: z.boolean().default(true),
  maxTravelPercent: z.number().int().min(0).max(100).nullable(),
  acceptedContractTypes: z.array(ContractTypeSchema).default([]),

  /** Sprachen mit Niveau nach GER, z. B. { de: "C2", en: "B2" }. */
  languages: z.record(z.string(), z.string()).default({}),
  /** Nachgewiesene Lizenzen und Zertifikate. */
  licenses: z.array(z.string()).default([]),
  workPermitCountries: z.array(z.string().length(2)).default([]),
  needsVisaSponsorship: z.boolean().default(false),

  earliestStartDate: z.date().nullable().default(null),
  /** Frei formulierte Ausschlüsse, z. B. "reine Kaltakquise". */
  hardNoGos: z.array(z.string()).default([]),

  /**
   * Was mit Stellen geschehen soll, bei denen eine Bedingung offen ist.
   *
   * Der Fall ist häufiger als der klare: eine Bedingung „mindestens
   * 45.000" trifft auf eine Anzeige ohne Gehaltsangabe. Die Stelle
   * verletzt die Bedingung nicht — sie sagt nichts dazu.
   *
   * Bisher rutschten diese Stellen stillschweigend in die Haupttreffer
   * und sahen dort aus wie geprüft. Jetzt ist es eine Entscheidung:
   *
   *   mitzeigen  die Voreinstellung. In den Haupttreffern, aber an
   *              jeder Zeile steht, was offen ist.
   *   getrennt   in einem eigenen Abschnitt. Für alle, die ihre
   *              Bedingungen streng gelesen haben wollen.
   *   ausblenden gar nicht. Nur belegt erfüllte Stellen.
   *
   * ── Warum die Voreinstellung „mitzeigen" ist ─────────────────
   *
   * Sie war zuerst „getrennt", und das war falsch — nicht in der
   * Absicht, sondern in der Folge. Gemessen an echten Daten: von 100
   * aktiven Stellen erfüllten bei einer Person mit Gehaltsuntergrenze
   * NULL die Bedingungen belegt. Nicht weil die Stellen schlecht
   * wären, sondern weil deutsche Anzeigen selten ein Gehalt nennen.
   * Die Hauptliste war leer, und darunter standen hundert Stellen im
   * Abschnitt „hier ist etwas offen".
   *
   * Eine Anwendung, die einer Person mit einer völlig normalen
   * Bedingung eine leere Liste zeigt, ist nicht streng, sondern
   * kaputt. Und sie erzieht dazu, die Bedingung wieder zu löschen.
   *
   * Der Missstand, um den es eigentlich ging, war nie die Platzierung,
   * sondern die Behauptung: eine offene Angabe sah aus wie eine
   * geprüfte. Das ist jetzt an der Stelle gelöst, an der es entsteht —
   * jede Zeile und jede Detailseite sagt „steht nicht in der Anzeige".
   * Unbekannt gilt nirgends als erfüllt; es steht nur nicht in einem
   * eigenen Zimmer.
   */
  unklaresBehandeln: z.enum(["ausblenden", "getrennt", "mitzeigen"]).default("mitzeigen"),
});
export type UserConstraints = z.infer<typeof UserConstraintsSchema>;

/** Ergebnis je Bedingung. "uncertain" ist bewusst kein "blocked". */
export const ConstraintVerdictSchema = z.enum(["eligible", "uncertain", "blocked"]);
export type ConstraintVerdict = z.infer<typeof ConstraintVerdictSchema>;

export const ConstraintCheckSchema = z.object({
  key: z.string(),
  /** In der Sprache des Menschen, nicht als Feldname. */
  label: z.string(),
  verdict: ConstraintVerdictSchema,
  /** Warum. Muss auch dann etwas sagen, wenn die Antwort "unbekannt" ist. */
  reason: z.string(),
  /** Was die Stelle fordert, soweit bekannt. */
  jobValue: z.string().nullable(),
  /** Was der Mensch braucht. */
  userValue: z.string().nullable(),
});
export type ConstraintCheck = z.infer<typeof ConstraintCheckSchema>;

export const ConstraintResultSchema = z.object({
  overall: ConstraintVerdictSchema,
  checks: z.array(ConstraintCheckSchema),
  blockedBy: z.array(z.string()),
  uncertainAbout: z.array(z.string()),
});
export type ConstraintResult = z.infer<typeof ConstraintResultSchema>;
