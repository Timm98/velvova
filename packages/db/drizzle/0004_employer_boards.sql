-- Registrierte Arbeitgeberboards (§4.5 bis 4.8).
--
-- Die Endpunkte von Greenhouse, Lever, Ashby und SmartRecruiters
-- antworten jedem, der den Firmennamen errät. Sie unterscheiden nicht,
-- ob jemand berechtigt ist. Diese Tabelle muss das tun.
CREATE TABLE IF NOT EXISTS "employer_boards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "board" text NOT NULL,
  "board_token" text NOT NULL,
  "employer_name" text NOT NULL,
  "employer_domain" text,
  "authorization_kind" text NOT NULL,
  "authorization_reference" text NOT NULL,
  "verified_at" timestamp with time zone NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "disabled_reason" text,
  "last_sync_at" timestamp with time zone,
  "last_sync_ok" boolean,
  "last_sync_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "employer_boards_board_check"
    CHECK ("board" IN ('greenhouse','lever','ashby','smartrecruiters')),
  CONSTRAINT "employer_boards_auth_check"
    CHECK ("authorization_kind" IN ('verified_domain','written_authorization','own_employer_account'))
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "employer_boards_unique"
  ON "employer_boards" ("board", "board_token")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employer_boards_enabled_idx" ON "employer_boards" ("enabled")
