CREATE TABLE "account_invites" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"workspace" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"expires" text NOT NULL,
	"used_at" text
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"recovery_hash" text NOT NULL,
	"created" text NOT NULL,
	CONSTRAINT "accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"expires" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace" text NOT NULL,
	"order_id" text NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"created" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_objects" (
	"id" text PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"content_type" text NOT NULL,
	"created" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace" text NOT NULL,
	"owner" text NOT NULL,
	"order_id" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"size" integer NOT NULL,
	"purpose" text NOT NULL,
	"created" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "glossary" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace" text NOT NULL,
	"source_language" text NOT NULL,
	"target_language" text NOT NULL,
	"sector" text NOT NULL,
	"source_term" text NOT NULL,
	"target_term" text NOT NULL,
	"created" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"name" text NOT NULL,
	"area" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace" text NOT NULL,
	"order_id" text NOT NULL,
	"sender" text NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"created" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace" text NOT NULL,
	"owner" text NOT NULL,
	"reference" text NOT NULL,
	"payload" text NOT NULL,
	"total" integer NOT NULL,
	"status" text NOT NULL,
	"payment" text DEFAULT 'Not requested' NOT NULL,
	"assignee" text,
	"courier" text,
	"shipment" text DEFAULT 'Awaiting assignment' NOT NULL,
	"created" text NOT NULL,
	"updated" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"expires" text NOT NULL,
	"created" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace" text NOT NULL,
	"owner" text NOT NULL,
	"request_key" text NOT NULL,
	"title" text NOT NULL,
	"source" text NOT NULL,
	"target" text NOT NULL,
	"sector" text NOT NULL,
	"tone" text NOT NULL,
	"file_id" text,
	"source_text" text DEFAULT '' NOT NULL,
	"segments" text DEFAULT '[]' NOT NULL,
	"draft" text DEFAULT '[]' NOT NULL,
	"result" text DEFAULT '[]' NOT NULL,
	"issues" text DEFAULT '[]' NOT NULL,
	"glossary" text DEFAULT '[]' NOT NULL,
	"state" text NOT NULL,
	"phase" text NOT NULL,
	"cursor" integer DEFAULT 0 NOT NULL,
	"lease" text,
	"lease_until" text,
	"error" text,
	"failures" integer DEFAULT 0 NOT NULL,
	"source_confirmed" integer DEFAULT 0 NOT NULL,
	"reviewer" text,
	"reviewer_note" text,
	"approved_at" text,
	"version" integer DEFAULT 1 NOT NULL,
	"model" text NOT NULL,
	"quote" text,
	"quote_accepted_at" text,
	"usage" text DEFAULT '{}' NOT NULL,
	"created" text NOT NULL,
	"updated" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"pricing" text NOT NULL,
	"created" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "events_order" ON "events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "files_order" ON "files" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "glossary_workspace" ON "glossary" USING btree ("workspace");--> statement-breakpoint
CREATE UNIQUE INDEX "glossary_term_pair" ON "glossary" USING btree ("workspace","source_language","target_language","sector","source_term");--> statement-breakpoint
CREATE UNIQUE INDEX "members_workspace_email" ON "members" USING btree ("workspace","email");--> statement-breakpoint
CREATE INDEX "members_email" ON "members" USING btree ("email");--> statement-breakpoint
CREATE INDEX "messages_order" ON "messages" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_workspace" ON "orders" USING btree ("workspace");--> statement-breakpoint
CREATE INDEX "orders_owner" ON "orders" USING btree ("owner");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_reference" ON "orders" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "sessions_account" ON "sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "translations_workspace_owner" ON "translations" USING btree ("workspace","owner");--> statement-breakpoint
CREATE UNIQUE INDEX "translations_request" ON "translations" USING btree ("owner","request_key");