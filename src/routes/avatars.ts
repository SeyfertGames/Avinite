import { Elysia, t } from "elysia";
import {
  listAvatars,
  searchAvatars,
} from "../services/avatar.service";
import {
  createAvatarSubmission,
} from "../services/submissions.service";
import { discordReviewBot } from "../bot/discord";
import type { ServerMessage } from "../types/ws";

const SUBMISSION_WINDOW_MS = 60 * 60 * 1000;
const MAX_SUBMISSIONS_PER_WINDOW = 5;
const INITIAL_AVATAR_LIST_DELAY_MS = 3_000;

const submissionAttempts = new Map<string, number[]>();
const pendingInitialLists = new Map<string, ReturnType<typeof setTimeout>>();

function getClientIp(ws: unknown): string {
  const request = (ws as { data?: { request?: Request } }).data?.request;
  const headers = request?.headers;

  if (!headers) {
    return "unknown";
  }

  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

function isSubmissionRateLimited(clientIp: string): boolean {
  const now = Date.now();
  const attempts = submissionAttempts.get(clientIp) ?? [];
  const recentAttempts = attempts.filter(
    (timestamp) => now - timestamp < SUBMISSION_WINDOW_MS,
  );

  if (recentAttempts.length >= MAX_SUBMISSIONS_PER_WINDOW) {
    submissionAttempts.set(clientIp, recentAttempts);
    return true;
  }

  recentAttempts.push(now);
  submissionAttempts.set(clientIp, recentAttempts);
  return false;
}

const submitPayloadSchema = t.Object({
  recordUri: t.String(),
  description: t.Optional(t.Nullable(t.String())),
  tags: t.Optional(t.Array(t.String())),
});

const searchPayloadSchema = t.Object({
  query: t.Optional(t.String()),
  tags: t.Optional(t.Array(t.String())),
});

const clientMessageSchema = t.Union([
  t.Object({ type: t.Literal("list") }),
  t.Object({ type: t.Literal("search"), payload: searchPayloadSchema }),
  t.Object({ type: t.Literal("submit"), payload: submitPayloadSchema }),
]);

function send(ws: { send: (msg: unknown) => void }, msg: ServerMessage) {
  ws.send(msg);
}

function clearPendingInitialList(wsId: string) {
  const timeout = pendingInitialLists.get(wsId);

  if (timeout) {
    clearTimeout(timeout);
    pendingInitialLists.delete(wsId);
  }
}

export const avatarsRoute = new Elysia({ prefix: "/ws" }).ws("/avatars", {
  body: clientMessageSchema,

  async open(ws) {
    const wsId = ws.id;

    const timeout = setTimeout(async () => {
      pendingInitialLists.delete(wsId);

      try {
        const data = await listAvatars();
        send(ws, { type: "avatars", data });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch avatars";
        send(ws, { type: "error", message });
      }
    }, INITIAL_AVATAR_LIST_DELAY_MS);

    pendingInitialLists.set(wsId, timeout);
  },

  async message(ws, msg) {
    try {
      if (msg.type === "list") {
        clearPendingInitialList(ws.id);

        const data = await listAvatars();
        send(ws, { type: "avatars", data });
        return;
      }

      if (msg.type === "search") {
        clearPendingInitialList(ws.id);

        const data = await searchAvatars(msg.payload);
        send(ws, { type: "searchResults", data });
        return;
      }

      if (msg.type === "submit") {
        const clientIp = getClientIp(ws);

        if (isSubmissionRateLimited(clientIp)) {
          send(ws, {
            type: "error",
            message:
              "Rate limit exceeded: maximum 5 submissions per hour per IP.",
          });
          return;
        }

        const data = await createAvatarSubmission(msg.payload);
        send(ws, { type: "pending", data });
        void discordReviewBot.queue(data);
        return;
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      send(ws, { type: "error", message });
    }
  },

  close(ws) {
    clearPendingInitialList(ws.id);
  },
});
