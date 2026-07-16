import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const avatars = pgTable("avatars", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  name: text("name").notNull(),
  author: text("author").notNull(),
  recordUri: text("record_uri").notNull().unique(),
  thumbnailUri: text("thumbnail_uri"),
  description: text("description"),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const avatarSubmissions = pgTable("avatar_submissions", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  sourceUri: text("source_uri").notNull(),
  recordUri: text("record_uri").notNull(),
  name: text("name").notNull(),
  author: text("author").notNull(),
  thumbnailUri: text("thumbnail_uri"),
  description: text("description"),
  tags: text("tags").array().notNull().default([]),
  status: text("status").notNull().default("pending"),
  discordChannelId: text("discord_channel_id"),
  discordMessageId: text("discord_message_id"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const table = {
  avatars,
  avatarSubmissions,
} as const;

export type Table = typeof table;
