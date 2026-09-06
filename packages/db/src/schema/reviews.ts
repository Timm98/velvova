import {
  boolean,
  index,
  integer,
  pgTable,
  pgView,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity.ts";

/**
 * Bewertungen der Plattform.
 *
 * Zwei Dinge unterscheiden sie von allem anderen im Produkt: der Inhalt
 * ist zur Veröffentlichung bestimmt, und er stammt von Menschen, die
 * uns nichts schulden.
 *
 * Deshalb gibt es neben der Tabelle eine SICHT (`publicReviews`), und
 * die Landingpage liest ausschliesslich aus ihr. Sie enthält nur
 * freigegebene Zeilen und nur öffentliche Spalten — keine
 * E-Mail-Adresse, keine Moderationsnotiz, keine Nutzerkennung. Der
 * Unterschied zu einer sorgfältigen `WHERE`-Klausel ist der Unterschied
 * zwischen „wir denken daran" und „es geht nicht anders".
 */

export const platformReviews = pgTable(
  "platform_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Falls angemeldet. Grundlage für „verifiziert" — nie geraten. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),

    displayName: text("display_name").notNull(),
    roleOrCompany: text("role_or_company"),
    /** Für Rückfragen. Steht nicht in der öffentlichen Sicht. */
    contactEmail: text("contact_email"),

    rating: integer("rating").notNull(),
    headline: text("headline"),
    body: text("body").notNull(),

    /** pending | approved | rejected */
    status: text("status").notNull().default("pending"),
    /** Von einem Menschen gesetzt, nachdem er nachgesehen hat. */
    isVerified: boolean("is_verified").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    helpfulCount: integer("helpful_count").notNull().default(0),

    avatarPath: text("avatar_path"),
    consentPublish: boolean("consent_publish").notNull().default(false),
    consentPrivacy: boolean("consent_privacy").notNull().default(false),

    /**
     * Wer abgesendet hat — als Hashwert, nur für die Ratenbegrenzung.
     *
     * Getrennt von `moderationNote`, und das ist keine Kosmetik: die
     * Notiz gehört einem Menschen und wird beim ersten
     * Moderationsvorgang überschrieben. Läge die Kennung darin, wäre
     * die Begrenzung ab da wirkungslos, ohne dass es jemand merkte.
     */
    submitterHash: text("submitter_hash"),
    moderationNote: text("moderation_note"),
    moderatedBy: uuid("moderated_by").references(() => users.id, { onDelete: "set null" }),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    index("platform_reviews_status_idx").on(t.status, t.publishedAt),
    index("platform_reviews_featured_idx").on(t.isFeatured, t.sortOrder),
  ],
);

/**
 * Was die Öffentlichkeit sehen darf.
 *
 * `.existing()`: die Sicht wird in Migration 0022 angelegt, nicht von
 * Drizzle. Hier steht nur ihre Form, damit Abfragen typisiert sind.
 */
export const publicReviews = pgView("public_reviews", {
  id: uuid("id").notNull(),
  displayName: text("display_name").notNull(),
  roleOrCompany: text("role_or_company"),
  rating: integer("rating").notNull(),
  headline: text("headline"),
  body: text("body").notNull(),
  isVerified: boolean("is_verified").notNull(),
  isFeatured: boolean("is_featured").notNull(),
  sortOrder: integer("sort_order").notNull(),
  helpfulCount: integer("helpful_count").notNull(),
  avatarPath: text("avatar_path"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
}).existing();

/**
 * Wer eine Bewertung schon hilfreich fand.
 *
 * Kein Konto nötig. Statt einer Nutzerkennung ein gesalzener Hashwert
 * aus Adresse, Browserkennung und Bewertungskennung — er verhindert die
 * zweite Stimme, ohne einen Leser über mehrere Bewertungen hinweg
 * wiedererkennbar zu machen.
 */
export const reviewHelpfulVotes = pgTable(
  "review_helpful_votes",
  {
    reviewId: uuid("review_id")
      .notNull()
      .references(() => platformReviews.id, { onDelete: "cascade" }),
    voterHash: text("voter_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.reviewId, t.voterHash] })],
);
