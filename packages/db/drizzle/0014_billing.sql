-- Abonnements und Abrechnung.
--
-- Bewusst anbieterneutral. Es steht noch nicht fest, ob die Zahlungen
-- über Stripe, Mollie, Adyen oder etwas anderes laufen — und diese
-- Entscheidung darf das Datenmodell nicht vorwegnehmen. Deshalb:
--
--   `provider`            wer abrechnet ("stripe", "mollie", …)
--   `provider_customer_id` deren Kennung für diesen Menschen
--   `provider_ref`         deren Kennung für dieses Abo
--
-- Ohne diese drei Felder klebt das Modell am ersten Anbieter, und ein
-- Wechsel wäre eine Migration statt einer Konfiguration.
--
-- Was hier NICHT gespeichert wird: Kartennummern, IBANs, Prüfziffern,
-- Zahlungsdaten jeder Art. Sie gehören zum Anbieter und nirgendwo
-- sonst hin. Von der Zahlungsart bleibt nur, was für die Anzeige
-- nötig ist — Art und die letzten vier Ziffern.

CREATE TYPE "plan_key" AS ENUM ('free', 'premium');
--> statement-breakpoint
CREATE TYPE "subscription_status" AS ENUM (
  'active', 'trialing', 'past_due', 'canceled', 'incomplete'
);
--> statement-breakpoint
CREATE TYPE "billing_interval" AS ENUM ('month', 'year');
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "billing_customers" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "provider_customer_id" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,

  "plan" "plan_key" NOT NULL DEFAULT 'free',
  "status" "subscription_status" NOT NULL DEFAULT 'active',
  "interval" "billing_interval",

  -- Bis wann bezahlt ist. Danach fällt der Zugang auf `free` zurück —
  -- ohne dass jemand etwas löschen muss.
  "current_period_end" timestamptz,
  -- Gekündigt, läuft aber noch: der Unterschied zwischen "sofort weg"
  -- und "bis zum Ende des Zeitraums".
  "cancel_at_period_end" boolean NOT NULL DEFAULT false,

  "provider" text,
  "provider_ref" text,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- Ein aktives Abo je Mensch. Zwei gleichzeitig wären eine doppelte
-- Abbuchung, und das merkt man erst auf der Rechnung.
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_user_idx"
  ON "subscriptions" ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "payment_methods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,

  -- card, paypal, apple_pay, google_pay, sepa_debit, bank_transfer
  "kind" text NOT NULL,
  -- Nur zur Wiedererkennung: "Visa •••• 4242". Keine vollständige
  -- Nummer, keine IBAN, keine Prüfziffer.
  "label" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,

  "provider" text NOT NULL,
  "provider_ref" text NOT NULL,

  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "payment_methods_user_idx"
  ON "payment_methods" ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,

  -- In der kleinsten Einheit der Währung. Beträge als Fliesskomma zu
  -- führen ist der Klassiker unter den Abrechnungsfehlern.
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'EUR',
  "status" text NOT NULL,
  "issued_at" timestamptz NOT NULL DEFAULT now(),
  "pdf_url" text,

  "provider" text,
  "provider_ref" text
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "invoices_user_idx"
  ON "invoices" ("user_id", "issued_at" DESC);
