import { db } from "../db";
import { avatars } from "../db/schema";
import { and, or, ilike, arrayOverlaps, desc, sql } from "drizzle-orm";
import type { AvatarInput, Avatar, SearchInput } from "../types/ws";
import { fetchResrecRecord } from "../utils/resonite";

export async function listAvatars(): Promise<Avatar[]> {
  return db.select().from(avatars).orderBy(desc(avatars.createdAt));
}

export async function searchAvatars(input: SearchInput): Promise<Avatar[]> {
  const conditions = [];

  if (input.query) {
    const q = `%${input.query}%`;
    const tagMatches = sql<boolean>`exists (
      select 1
      from unnest(${avatars.tags}) as tag
      where tag ilike ${q}
    )`;

    conditions.push(
      or(
        ilike(avatars.name, q),
        ilike(avatars.author, q),
        ilike(avatars.description, q),
        tagMatches,
      ),
    );
  }

  if (input.tags && input.tags.length > 0) {
    conditions.push(arrayOverlaps(avatars.tags, input.tags));
  }

  return db
    .select()
    .from(avatars)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(avatars.createdAt));
}

export async function upsertAvatar(input: AvatarInput): Promise<Avatar> {
  const now = new Date();

  let recordUri = input.recordUri;
  let name = "Unknown";
  let author = "Unknown";
  let thumbnailUri: string | null = null;
  let tags: string[] = [];

  if (input.recordUri.startsWith("resrec://")) {
    const record = await fetchResrecRecord(input.recordUri);
    if (record) {
      if (record.assetUri) recordUri = record.assetUri;
      if (record.name) name = record.name;
      if (record.ownerId) author = record.ownerId.replace(/^[UG]-/, "");
      thumbnailUri = record.thumbnailUri;
      tags = record.tags;
    }
  }

  if (input.tags && input.tags.length > 0) tags = input.tags;

  const [result] = await db
    .insert(avatars)
    .values({
      name,
      author,
      recordUri,
      thumbnailUri,
      description: input.description ?? null,
      tags,
    })
    .onConflictDoUpdate({
      target: avatars.recordUri,
      set: {
        name,
        author,
        thumbnailUri,
        description: input.description ?? null,
        tags,
        updatedAt: now,
      },
    })
    .returning();

  if (!result) {
    throw new Error("Upsert did not return a result");
  }

  return result;
}
