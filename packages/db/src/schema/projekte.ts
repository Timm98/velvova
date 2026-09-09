import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./identity.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Projekte — ein Suchvorhaben mit allem, was dazugehört
 * ══════════════════════════════════════════════════════════════════
 *
 * Ein Mensch sucht nicht „einen Job". Er sucht Projektmanagement in
 * Zürich — und daneben, halb ernst, etwas ganz anderes in Berlin.
 * Beides in einem Faden zu führen heisst, dass jede Frage zur einen
 * Suche die andere mitschleppt.
 *
 * ── Warum das Gedächtnis dabei nicht zerfällt ───────────────────
 *
 * Was Monday über den Menschen weiss — bestätigte Fakten, harte
 * Bedingungen, verworfene Aussagen — hängt an `user_id`, nicht am
 * Gespräch. Es folgt deshalb in jedes Projekt, ohne dass dafür etwas
 * nötig wäre.
 *
 * Getrennt ist nur der Verlauf. Genau das war die Anforderung: Die KI
 * soll merken, dass es ein anderes Projekt ist, und trotzdem wissen,
 * wer vor ihr sitzt.
 */
export const projekte = pgTable(
  "projekte",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    /** Wie es in der Seitenleiste steht. Kurz, vom Menschen bestätigt. */
    name: text("name").notNull(),
    /** Was gesucht wird, in einem Satz — aus dem Gespräch, in dem es entstand. */
    ziel: text("ziel"),

    /**
     * `aktiv` | `ruht` | `abgeschlossen`
     *
     * `ruht` ist nicht dasselbe wie gelöscht: Eine Suche, die man
     * pausiert, will man wiederfinden.
     */
    status: text("status").notNull().default("aktiv"),

    /** Kleiner steht weiter oben. Ohne eigene Ordnung wäre es das Anlagedatum. */
    ordnung: integer("ordnung").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("projekte_person_idx").on(t.userId, t.status, t.ordnung),
    /* Zwei Projekte „Zürich" nebeneinander sind in einer Seitenleiste
       nicht auseinanderzuhalten. */
    uniqueIndex("projekte_person_name_unique").on(t.userId, sql`lower(${t.name})`),
  ],
);
