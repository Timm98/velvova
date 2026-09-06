import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity.ts";
import { jobs } from "./jobs.ts";

/**
 * Gehaltsberechnung — Angaben, Läufe, Regelwerke.
 *
 * Die Angaben sind sensible Finanzdaten: Steuerklasse und Kinderzahl
 * sagen etwas über die Lebensform, die Krankenkasse über die
 * Gesundheit, das Bundesland über den Wohnort. Deshalb stehen beide
 * nutzerbezogenen Tabellen im Zeilenschutz, und deshalb ist Speichern
 * eine ausdrückliche Wahl (`savePreferences`) und keine Nebenwirkung
 * des Rechnens.
 */

export const salaryCalculationProfiles = pgTable(
  "salary_calculation_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    countryCode: text("country_code").notNull().default("DE"),
    taxYear: integer("tax_year").notNull(),
    taxClass: integer("tax_class"),
    federalState: text("federal_state"),
    churchTax: boolean("church_tax").notNull().default(false),
    healthInsuranceType: text("health_insurance_type").notNull().default("gesetzlich"),
    healthInsurerName: text("health_insurer_name"),
    healthAdditionalRate: doublePrecision("health_additional_rate"),
    careInsuranceStatus: text("care_insurance_status"),
    childrenCount: integer("children_count"),
    paymentFrequency: integer("payment_frequency").notNull().default(12),
    /**
     * Ob diese Angaben bleiben dürfen.
     *
     * `false` heisst: nur für diese eine Berechnung. Die Voreinstellung
     * — wer Steuerklasse und Kinderzahl hinterlässt, soll das
     * ausdrücklich gewollt haben.
     */
    savePreferences: boolean("save_preferences").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("salary_profiles_user_year_idx").on(t.userId, t.countryCode, t.taxYear)],
);

export const salaryCalculationRuns = pgTable(
  "salary_calculation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    grossAnnual: integer("gross_annual").notNull(),
    grossMonthly: integer("gross_monthly"),
    variableCompensation: integer("variable_compensation").notNull().default(0),
    paymentFrequency: integer("payment_frequency").notNull().default(12),
    currency: text("currency").notNull().default("EUR"),
    countryCode: text("country_code").notNull(),
    taxYear: integer("tax_year").notNull(),
    /**
     * Mit welcher Fassung der Regeln gerechnet wurde.
     *
     * Ohne sie lässt sich ein gespeichertes Ergebnis später nicht mehr
     * erklären — die Regeln ändern sich jedes Jahr, und dieselbe
     * Eingabe ergibt dann eine andere Zahl.
     */
    ruleSetVersion: text("rule_set_version").notNull(),
    inputSnapshot: jsonb("input_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    resultSnapshot: jsonb("result_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    assumptions: jsonb("assumptions").$type<string[]>().notNull().default([]),
    calculationStatus: text("calculation_status").notNull().default("ok"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("salary_runs_user_idx").on(t.userId, t.createdAt)],
);

/**
 * Welche Regelwerke ausgeliefert werden und welches gilt.
 *
 * Gerechnet wird im Code; diese Tabelle ist die Auskunft für den
 * Betrieb — welches Jahr, welche Fassung, seit wann, und vor allem, ob
 * es freigegeben ist. Ohne `approvedForProduction` sagt die Oberfläche,
 * dass es eine Schätzung ist.
 */
export const payrollRuleSets = pgTable(
  "payroll_rule_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    countryCode: text("country_code").notNull(),
    taxYear: integer("tax_year").notNull(),
    version: text("version").notNull(),
    sourceMetadata: jsonb("source_metadata")
      .$type<{ titel: string; stand: string }[]>()
      .notNull()
      .default([]),
    validFrom: date("valid_from").notNull(),
    validUntil: date("valid_until"),
    approvedForProduction: boolean("approved_for_production").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("payroll_rule_sets_unique").on(t.countryCode, t.taxYear, t.version)],
);
