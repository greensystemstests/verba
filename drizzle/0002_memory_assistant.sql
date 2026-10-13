-- Translation memory: source/target pairs learned from finished translations or imported (TMX/CSV).
CREATE TABLE "memory" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace" text NOT NULL,
	"source_language" text NOT NULL,
	"target_language" text NOT NULL,
	"sector" text DEFAULT 'General' NOT NULL,
	"source_text" text NOT NULL,
	"target_text" text NOT NULL,
	"source_key" text NOT NULL,
	"words" integer NOT NULL,
	"quality" text NOT NULL,
	"origin" text,
	"uses" integer DEFAULT 0 NOT NULL,
	"created" text NOT NULL,
	"updated" text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "memory_unique" ON "memory" ("workspace","source_language","target_language","source_key");--> statement-breakpoint
CREATE INDEX "memory_pair" ON "memory" ("workspace","source_language","target_language","words");--> statement-breakpoint
-- Customer-service assistant: "on" answers automatically, "human" means a person has taken over or was requested.
ALTER TABLE "conversations" ADD COLUMN "assistant" text DEFAULT 'on' NOT NULL;
