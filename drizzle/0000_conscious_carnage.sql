CREATE TABLE "avatars" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"author" text NOT NULL,
	"record_uri" text NOT NULL,
	"thumbnail_uri" text,
	"description" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "avatars_record_uri_unique" UNIQUE("record_uri")
);
