import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity.ts";

/**
 * Dokumente, die eine Person selbst mitbringt.
 *
 * Lebenslauf, Zeugnisse, eine Stellenanzeige als PDF, eine alte
 * Bewerbung, eine Absage. Es sind die persönlichsten Daten im ganzen
 * Produkt: darin stehen Namen, Adressen, Geburtsdaten, manchmal eine
 * Krankheit oder ein Kündigungsgrund.
 *
 * Vier Tabellen statt einer, und die Trennung ist der Kern:
 *
 *   `userDocuments`        die Datei — wem sie gehört, wo sie liegt.
 *   `documentExtractions`  ihr Text — getrennt, damit das Original
 *                          unberührt bleibt.
 *   `documentClaims`       was daraus folgt — MIT Fundstelle.
 *   `documentPermissions`  wie weit es reichen darf — die Wahl der Person.
 *
 * Die Fundstelle in `documentClaims` ist keine Feinheit. Ohne sie ist
 * eine Ableitung nicht von einer Erfindung zu unterscheiden — und eine
 * Erfindung über den Lebenslauf einer Person ist der teuerste Fehler,
 * den dieses Produkt machen kann.
 */

export const userDocuments = pgTable(
  "user_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Wofür die Person die Datei hält — ihre Angabe, nicht unsere
     * Erkennung. Was wir erkennen, steht in `documentExtractions.kind`.
     * Die beiden auseinanderzuhalten erlaubt die Rückfrage: „Du hast
     * das als Zeugnis hochgeladen, ich lese einen Lebenslauf."
     */
    declaredKind: text("declared_kind").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    storageBucket: text("storage_bucket").notNull(),
    storagePath: text("storage_path").notNull(),
    contentHash: text("content_hash"),
    /** pending | scanning | extracting | ready | rejected | failed */
    status: text("status").notNull().default("pending"),
    rejectedReason: text("rejected_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("user_documents_user_idx").on(t.userId)],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => userDocuments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    storagePath: text("storage_path").notNull(),
    byteSize: integer("byte_size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("document_versions_unique").on(t.documentId, t.version)],
);

export const documentExtractions = pgTable(
  "document_extractions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => userDocuments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** cv | cover_letter | reference | certificate | job_ad | rejection | other */
    kind: text("kind").notNull(),
    plainText: text("plain_text"),
    pageCount: integer("page_count"),
    language: text("language"),
    /** Womit gelesen wurde — für den Fall, dass ein Leser sich irrt. */
    extractor: text("extractor").notNull(),
    extractorVersion: text("extractor_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("document_extractions_doc_idx").on(t.documentId)],
);

export const documentClaims = pgTable(
  "document_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    extractionId: uuid("extraction_id")
      .notNull()
      .references(() => documentExtractions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** skill | role | employer | period | qualification | tool | achievement */
    kind: text("kind").notNull(),
    statement: text("statement").notNull(),
    /** Wo im Text es steht. Ohne Fundstelle keine Behauptung. */
    sourceStart: integer("source_start"),
    sourceEnd: integer("source_end"),
    sourceQuote: text("source_quote"),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    /**
     * Nichts wird automatisch bestätigt.
     *
     * Ein hochgeladener Lebenslauf ist eine Behauptung der Person über
     * sich selbst, kein Beleg. Er wird zu bestätigter Evidenz, wenn sie
     * ihn bestätigt — nicht, weil eine Datei angekommen ist.
     */
    userConfirmed: boolean("user_confirmed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("document_claims_extraction_idx").on(t.extractionId)],
);

export const documentPermissions = pgTable(
  "document_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => userDocuments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Wie weit die Datei reichen darf.
     *
     * chat_only | application | career_profile | none
     *
     * Voreinstellung ist die engste. Wer nichts wählt, hat nicht
     * zugestimmt — und eine Voreinstellung, die mehr erlaubt als
     * gewählt wurde, ist keine Wahl.
     */
    scope: text("scope").notNull().default("chat_only"),
    conversationId: uuid("conversation_id"),
    applicationId: uuid("application_id"),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("document_permissions_doc_idx").on(t.documentId)],
);

export const documentProcessingRuns = pgTable(
  "document_processing_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => userDocuments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    step: text("step").notNull(),
    status: text("status").notNull(),
    detail: text("detail"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("document_runs_doc_idx").on(t.documentId)],
);
