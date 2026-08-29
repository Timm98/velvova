ALTER TABLE "user_settings" ADD COLUMN "assistant_locale" "locale" DEFAULT 'de' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "document_locale" "locale" DEFAULT 'de' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "job_market_country" text DEFAULT 'DE' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "distance_unit" text DEFAULT 'km' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "remote_preference" text DEFAULT 'no_preference' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "employment_types" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "desired_salary_min" integer;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "desired_salary_period" text DEFAULT 'year' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "voice_autoplay" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "voice_captions" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "voice_speed" double precision DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "delete_audio_after_transcript" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "onboarding_completed_at" timestamp with time zone;