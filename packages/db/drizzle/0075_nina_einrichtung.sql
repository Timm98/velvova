CREATE TABLE IF NOT EXISTS "nina_einrichtung" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"kontotyp" text NOT NULL,
	"abgeschlossen" boolean DEFAULT false NOT NULL,
	"abgeschlossen_am" timestamp with time zone,
	"bedienart" text,
	"sprachspeicherung" text DEFAULT 'nur_bestaetigte' NOT NULL,
	"stufe" text,
	"briefing_aktiv" boolean DEFAULT false NOT NULL,
	"briefing_rhythmus" text DEFAULT 'werktags' NOT NULL,
	"briefing_zeit" text DEFAULT '08:00' NOT NULL,
	"zeitzone" text DEFAULT 'Europe/Berlin' NOT NULL,
	"kanaele" jsonb DEFAULT '["in_app"]'::jsonb NOT NULL,
	"textfassung" text,
	"zugestimmt_am" timestamp with time zone,
	"widerrufen_am" timestamp with time zone,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"aktualisiert_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nina_einrichtung_protokoll" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ereignis" text NOT NULL,
	"vorher" text,
	"nachher" text,
	"textfassung" text,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nina_einrichtung" ADD CONSTRAINT "nina_einrichtung_user_id_users_id_fk"
   FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nina_einrichtung_protokoll" ADD CONSTRAINT "nina_protokoll_user_id_users_id_fk"
   FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nina_protokoll_user_idx" ON "nina_einrichtung_protokoll" ("user_id","erstellt_am");
