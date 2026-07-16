import type { avatarSubmissions, avatars } from "../db/schema";
import type { InferSelectModel } from "drizzle-orm";

export type Avatar = InferSelectModel<typeof avatars>;

export type AvatarSubmission = InferSelectModel<typeof avatarSubmissions>;

export type SubmissionStatus = "pending" | "approved" | "rejected";

export type AvatarInput = {
  recordUri: string;
  description?: string | null;
  tags?: string[];
};

export type SearchInput = {
  query?: string;
  tags?: string[];
};

export type ClientMessage =
  | { type: "list" }
  | { type: "search"; payload: SearchInput }
  | { type: "submit"; payload: AvatarInput };

export type ServerMessage =
  | { type: "avatars"; data: Avatar[] }
  | { type: "searchResults"; data: Avatar[] }
  | { type: "pending"; data: AvatarSubmission }
  | { type: "error"; message: string };
