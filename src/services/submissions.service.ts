import { and, arrayOverlaps, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../db";
import { avatarSubmissions, avatars } from "../db/schema";
import type {
  Avatar,
  AvatarInput,
  AvatarSubmission,
  SearchInput,
} from "../types/ws";
import { fetchResrecRecord } from "../utils/resonite";

function normalizeTags(tags: string[] | undefined): string[] {
  return (tags ?? []).map((tag) => tag.trim()).filter(Boolean);
}

async function resolveSubmission(input: AvatarInput) {
  let sourceUri = input.recordUri;
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

  const submittedTags = normalizeTags(input.tags);
  if (submittedTags.length > 0) tags = submittedTags;

  return {
    sourceUri,
    recordUri,
    name,
    author,
    thumbnailUri,
    description: input.description ?? null,
    tags,
  };
}

export async function listPendingAvatarSubmissions(): Promise<
  AvatarSubmission[]
> {
  return db
    .select()
    .from(avatarSubmissions)
    .where(eq(avatarSubmissions.status, "pending"))
    .orderBy(desc(avatarSubmissions.createdAt));
}

export async function getAvatarSubmission(
  submissionId: string,
): Promise<AvatarSubmission | null> {
  const [submission] = await db
    .select()
    .from(avatarSubmissions)
    .where(eq(avatarSubmissions.id, submissionId))
    .limit(1);

  return submission ?? null;
}

export async function createAvatarSubmission(
  input: AvatarInput,
): Promise<AvatarSubmission> {
  const resolved = await resolveSubmission(input);
  const now = new Date();

  const [submission] = await db
    .insert(avatarSubmissions)
    .values({
      sourceUri: resolved.sourceUri,
      recordUri: resolved.recordUri,
      name: resolved.name,
      author: resolved.author,
      thumbnailUri: resolved.thumbnailUri,
      description: resolved.description,
      tags: resolved.tags,
      status: "pending",
      updatedAt: now,
    })
    .returning();

  if (!submission) {
    throw new Error("Failed to create avatar submission");
  }

  return submission;
}

export async function attachDiscordReviewMessage(
  submissionId: string,
  discordChannelId: string,
  discordMessageId: string,
): Promise<void> {
  await db
    .update(avatarSubmissions)
    .set({
      discordChannelId,
      discordMessageId,
      updatedAt: new Date(),
    })
    .where(eq(avatarSubmissions.id, submissionId));
}

export async function approveAvatarSubmission(
  submissionId: string,
  reviewedBy?: string,
): Promise<Avatar> {
  const submission = await getAvatarSubmission(submissionId);

  if (!submission) {
    throw new Error("Submission not found");
  }

  if (submission.status !== "pending") {
    throw new Error(`Submission is already ${submission.status}`);
  }

  const now = new Date();

  const [avatar] = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(avatars)
      .values({
        name: submission.name,
        author: submission.author,
        recordUri: submission.recordUri,
        thumbnailUri: submission.thumbnailUri,
        description: submission.description,
        tags: submission.tags,
      })
      .onConflictDoUpdate({
        target: avatars.recordUri,
        set: {
          name: submission.name,
          author: submission.author,
          thumbnailUri: submission.thumbnailUri,
          description: submission.description,
          tags: submission.tags,
          updatedAt: now,
        },
      })
      .returning();

    await tx
      .update(avatarSubmissions)
      .set({
        status: "approved",
        reviewedBy: reviewedBy ?? null,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(avatarSubmissions.id, submissionId));

    if (!inserted) {
      throw new Error("Failed to approve submission");
    }

    return [inserted];
  });

  return avatar;
}

export async function rejectAvatarSubmission(
  submissionId: string,
  reviewedBy?: string,
): Promise<AvatarSubmission> {
  const submission = await getAvatarSubmission(submissionId);

  if (!submission) {
    throw new Error("Submission not found");
  }

  const now = new Date();

  const [updated] = await db
    .update(avatarSubmissions)
    .set({
      status: "rejected",
      reviewedBy: reviewedBy ?? null,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(avatarSubmissions.id, submissionId))
    .returning();

  if (!updated) {
    throw new Error("Failed to reject submission");
  }

  return updated;
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