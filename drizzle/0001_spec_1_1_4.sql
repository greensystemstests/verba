CREATE SEQUENCE "public"."order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."shipment_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1;--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"sender_kind" text NOT NULL,
	"sender_email" text DEFAULT '' NOT NULL,
	"sender_name" text NOT NULL,
	"body" text NOT NULL,
	"created" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace" text NOT NULL,
	"account_id" text,
	"guest_hash" text,
	"name" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'support' NOT NULL,
	"order_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"assignee" text,
	"last_message_at" text NOT NULL,
	"staff_read_at" text,
	"customer_read_at" text,
	"created" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"purpose" text NOT NULL,
	"expires" text NOT NULL,
	"used_at" text,
	"created" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace" text,
	"recipient" text NOT NULL,
	"channel" text NOT NULL,
	"template" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"created" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_identities" (
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"account_id" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"created" text NOT NULL,
	CONSTRAINT "oauth_identities_provider_subject_pk" PRIMARY KEY("provider","subject")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace" text NOT NULL,
	"number" integer NOT NULL,
	"order_id" text,
	"customer_account" text,
	"customer_name" text NOT NULL,
	"customer_email" text DEFAULT '' NOT NULL,
	"customer_phone" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"delivery_date" text,
	"same_day" integer DEFAULT 0 NOT NULL,
	"next_day" integer DEFAULT 0 NOT NULL,
	"urgency" text DEFAULT 'Standard' NOT NULL,
	"type" text DEFAULT '1 way' NOT NULL,
	"operator" text DEFAULT '' NOT NULL,
	"courier" text,
	"return_courier" text,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"sum" integer DEFAULT 0 NOT NULL,
	"international" integer DEFAULT 0 NOT NULL,
	"tracking" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created" text NOT NULL,
	"updated" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ui_texts" (
	"lang" text NOT NULL,
	"source" text NOT NULL,
	"value" text NOT NULL,
	"updated" text NOT NULL,
	CONSTRAINT "ui_texts_lang_source_pk" PRIMARY KEY("lang","source")
);
--> statement-breakpoint
CREATE TABLE "upload_chunks" (
	"upload_id" text NOT NULL,
	"idx" integer NOT NULL,
	"owner_key" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created" text NOT NULL,
	CONSTRAINT "upload_chunks_upload_id_idx_pk" PRIMARY KEY("upload_id","idx")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "first_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "last_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "email_verified_at" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "company" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "customer_type" text DEFAULT 'Private' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "country" text DEFAULT 'IL' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "address" text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "notify" text DEFAULT '["email"]' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "currency" text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "disabled_at" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "phone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "business_number" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "active" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "number" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "due_date" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "vendor" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "currency" text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "config" text DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX "conversation_messages_conversation" ON "conversation_messages" USING btree ("conversation_id","created");--> statement-breakpoint
CREATE INDEX "conversations_workspace" ON "conversations" USING btree ("workspace","last_message_at");--> statement-breakpoint
CREATE INDEX "conversations_account" ON "conversations" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "conversations_guest" ON "conversations" USING btree ("guest_hash");--> statement-breakpoint
CREATE INDEX "email_tokens_account" ON "email_tokens" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "notifications_workspace" ON "notifications" USING btree ("workspace","created");--> statement-breakpoint
CREATE INDEX "shipments_workspace" ON "shipments" USING btree ("workspace");--> statement-breakpoint
CREATE INDEX "shipments_order" ON "shipments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "shipments_courier" ON "shipments" USING btree ("courier");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_number" ON "shipments" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_phone" ON "accounts" USING btree ("phone") WHERE phone IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number" ON "orders" USING btree ("number");--> statement-breakpoint
-- Backfill: running numbers for existing orders, in creation order.
UPDATE "orders" o SET "number" = s.n FROM (SELECT id, 1000 + row_number() OVER (ORDER BY created, id) AS n FROM "orders") s WHERE o.id = s.id;--> statement-breakpoint
SELECT setval('order_number_seq', GREATEST(1001, (SELECT COALESCE(MAX("number"), 1000) + 1 FROM "orders")), false);--> statement-breakpoint
-- Accounts created by invitation were confirmed by an administrator; split stored names.
UPDATE "accounts" SET "email_verified_at" = "created" WHERE "email_verified_at" IS NULL;--> statement-breakpoint
UPDATE "accounts" SET "first_name" = split_part("name", ' ', 1), "last_name" = btrim(substr("name", length(split_part("name", ' ', 1)) + 1)) WHERE "first_name" = '';--> statement-breakpoint
-- One shipment record for every existing order that included courier delivery.
INSERT INTO "shipments" ("id","workspace","number","order_id","customer_account","customer_name","customer_email","customer_phone","status","urgency","type","operator","courier","origin","destination","sum","created","updated")
SELECT gen_random_uuid()::text, o.workspace, 1000 + row_number() OVER (ORDER BY o.created, o.id), o.id, o.owner, COALESCE(p->>'name',''), COALESCE(p->>'email',''), COALESCE(p->>'phone',''), o.shipment, COALESCE(p->>'urgency','Standard'), '1 way', 'Local courier', o.courier, COALESCE(p->'pickup','{}'::jsonb)::text, COALESCE(p->'dropoff','{}'::jsonb)::text, CASE WHEN p->>'service' = 'Courier only' THEN o.total ELSE 0 END, o.created, o.updated
FROM "orders" o CROSS JOIN LATERAL (SELECT o.payload::jsonb AS p) x WHERE (p->>'delivery') = 'true' OR p->>'service' = 'Courier only';--> statement-breakpoint
SELECT setval('shipment_number_seq', GREATEST(1001, (SELECT COALESCE(MAX("number"), 1000) + 1 FROM "shipments")), false);
