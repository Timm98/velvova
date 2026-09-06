-- Bewertungen der Plattform.
--
-- Zwei Dinge unterscheiden diese Tabelle von allen anderen im Produkt:
-- ihr Inhalt ist zur Veröffentlichung bestimmt, und er stammt von
-- Menschen, die uns nichts schulden. Beides verlangt Vorsicht in
-- verschiedene Richtungen.
--
--   **Nach aussen:** nur was freigegeben ist, wird sichtbar. Der
--   Standard ist „ausstehend", und der Weg nach draussen führt über
--   einen Menschen.
--
--   **Nach innen:** was jemand zur Veröffentlichung freigibt, ist nicht
--   dasselbe wie das, was er uns geschrieben hat. Die E-Mail-Adresse
--   steht in derselben Zeile und darf nie mit hinaus.
--
-- Die Trennung erledigt eine SICHT, nicht eine Abfrage. Eine Abfrage
-- kann man vergessen; eine Sicht, die nur freigegebene Zeilen und nur
-- öffentliche Spalten kennt, kann die Landingpage gar nicht falsch
-- benutzen.

CREATE TABLE IF NOT EXISTS "platform_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  /*
   * Wer bewertet hat — falls angemeldet.
   *
   * Nullbar, weil auch jemand ohne Konto bewerten können soll. Ist sie
   * gesetzt, lässt sich später nachvollziehen, ob die Person das
   * Produkt tatsächlich benutzt hat: das ist die Grundlage für
   * „verifiziert", und die darf nicht geraten werden.
   */
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,

  "display_name" text NOT NULL,
  /** Firma oder Position. Freiwillig. */
  "role_or_company" text,
  /*
   * Für Rückfragen und gegen Missbrauch — niemals öffentlich.
   *
   * Sie steht ausdrücklich NICHT in der öffentlichen Sicht. Eine
   * E-Mail-Adresse, die neben einer namentlichen Bewertung im Netz
   * steht, ist eine Einladung an Spam und Schlimmeres.
   */
  "contact_email" text,

  "rating" integer NOT NULL,
  "headline" text,
  "body" text NOT NULL,

  /** pending | approved | rejected */
  "status" text NOT NULL DEFAULT 'pending',
  /*
   * Vom Team bestätigt, dass die Person das Produkt benutzt hat.
   *
   * Kein Automatismus und keine Vermutung: ein Häkchen, das ein Mensch
   * setzt, nachdem er nachgesehen hat. Ein „verifiziert", das sich
   * selbst vergibt, ist ein Werbeaufkleber.
   */
  "is_verified" boolean NOT NULL DEFAULT false,
  "is_featured" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "helpful_count" integer NOT NULL DEFAULT 0,

  "avatar_path" text,
  /** Die ausdrückliche Zustimmung zur Veröffentlichung. Ohne sie: nie. */
  "consent_publish" boolean NOT NULL DEFAULT false,
  "consent_privacy" boolean NOT NULL DEFAULT false,

  /** Interne Notiz der Moderation. Nie öffentlich. */
  "moderation_note" text,
  "moderated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "moderated_at" timestamp with time zone,

  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "published_at" timestamp with time zone,

  CONSTRAINT "platform_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "platform_reviews_status_check" CHECK ("status" IN ('pending','approved','rejected')),
  CONSTRAINT "platform_reviews_body_check" CHECK (char_length("body") BETWEEN 30 AND 5000),
  /*
   * Freigegeben heisst zugestimmt.
   *
   * Auf Datenbankebene und nicht nur im Formular: eine Bewertung ohne
   * ausdrückliche Zustimmung darf nicht veröffentlicht werden können,
   * auch nicht durch einen Fehler in der Moderationsoberfläche oder
   * durch eine Hand am SQL.
   */
  CONSTRAINT "platform_reviews_consent_check"
    CHECK ("status" <> 'approved' OR ("consent_publish" AND "consent_privacy"))
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "platform_reviews_status_idx"
  ON "platform_reviews" ("status", "published_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "platform_reviews_featured_idx"
  ON "platform_reviews" ("is_featured", "sort_order") WHERE "status" = 'approved';
--> statement-breakpoint

/*
 * Die öffentliche Sicht.
 *
 * Sie ist der einzige Weg, auf dem eine Bewertung nach draussen gelangt.
 * Zwei Eigenschaften machen sie sicher, und beide sind struktureller
 * Natur — man kann sie nicht vergessen:
 *
 *   Sie enthält nur `status = 'approved'`. Eine ausstehende oder
 *   abgelehnte Bewertung ist hier nicht vorhanden, nicht bloss
 *   herausgefiltert.
 *
 *   Sie enthält weder `contact_email` noch `moderation_note` noch
 *   `user_id`. Was nicht in der Sicht steht, kann keine Abfrage
 *   versehentlich mitnehmen.
 *
 * Der Unterschied zu einer sorgfältigen `WHERE`-Klausel ist der
 * Unterschied zwischen „wir denken daran" und „es geht nicht anders".
 */
CREATE OR REPLACE VIEW "public_reviews" AS
SELECT
  "id",
  "display_name",
  "role_or_company",
  "rating",
  "headline",
  "body",
  "is_verified",
  "is_featured",
  "sort_order",
  "helpful_count",
  "avatar_path",
  "published_at"
FROM "platform_reviews"
WHERE "status" = 'approved' AND "consent_publish" AND "consent_privacy";
--> statement-breakpoint

/*
 * Wer eine Bewertung schon hilfreich fand.
 *
 * Kein Konto nötig — die meisten, die eine Bewertung lesen, haben
 * keines. Statt einer Nutzerkennung steht hier ein Hashwert aus
 * Adresse und Browserkennung, mit einem serverseitigen Geheimnis
 * gesalzen.
 *
 * Das ist bewusst kein perfekter Schutz: Wer will, kommt daran vorbei.
 * Es ist auch bewusst keine Kennung, die eine Person wiedererkennbar
 * macht — aus dem Hash lässt sich weder die Adresse zurückrechnen noch
 * jemand über mehrere Bewertungen hinweg verfolgen, weil die
 * Bewertungskennung mit einfliesst.
 *
 * Die Abwägung: eine Stimme mehrfach zu verhindern ist ein
 * Ordnungsproblem. Leser zu verfolgen wäre ein Vertrauensbruch.
 */
CREATE TABLE IF NOT EXISTS "review_helpful_votes" (
  "review_id" uuid NOT NULL REFERENCES "platform_reviews"("id") ON DELETE CASCADE,
  "voter_hash" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("review_id", "voter_hash")
);
