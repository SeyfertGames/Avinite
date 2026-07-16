CREATE TABLE "avatar_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"source_uri" text NOT NULL,
	"record_uri" text NOT NULL,
	"name" text NOT NULL,
	"author" text NOT NULL,
	"thumbnail_uri" text,
	"description" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"discord_channel_id" text,
	"discord_message_id" text,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
