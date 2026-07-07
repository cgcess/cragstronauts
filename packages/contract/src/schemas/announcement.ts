import { z } from "zod";

// The fixed set of reactions offered on announcements + replies. Kept in the
// contract so the API and web agree on what's allowed; the toggle route rejects
// anything outside it.
export const ANNOUNCEMENT_REACTIONS = ["❤️", "👍", "🎉", "😂", "🔥", "🙌"] as const;

// One entry per distinct emoji used on a message. The client derives the count
// (`user_ids.length`) and whether the viewer reacted (`user_ids.includes(me)`),
// mirroring how polls derive "answered" client-side — so a GET needs no viewer id.
export const AnnouncementReactionSchema = z.object({
  emoji: z.string(),
  user_ids: z.array(z.number()),
});

// Fields shared by a post and a reply. `parent_id` and `replies` are layered on
// per shape below.
const messageBase = {
  id: z.number(),
  // Null once the author leaves the trip (row survives via ON DELETE SET NULL).
  user_id: z.number().nullable(),
  author_name: z.string(),
  author_avatar_url: z.string().nullable(),
  body: z.string(),
  created_at: z.string(),
  reactions: z.array(AnnouncementReactionSchema),
};

// A one-level reply. Same shape as an announcement minus the nested `replies`.
export const AnnouncementReplySchema = z.object({
  ...messageBase,
  parent_id: z.number(),
});

// A top-level announcement with its reactions and its one level of replies.
export const AnnouncementSchema = z.object({
  ...messageBase,
  parent_id: z.null(),
  replies: z.array(AnnouncementReplySchema),
});

// What POST returns: a freshly created message (post or reply). It carries no
// replies (a new post has none; a reply can't have any), and `parent_id` is
// null for a post or the parent id for a reply.
export const CreatedAnnouncementSchema = z.object({
  ...messageBase,
  parent_id: z.number().nullable(),
});

export const CreateAnnouncementBodySchema = z.object({
  user_id: z.number(),
  body: z.string().min(1),
  // Snapshot of the author's Clerk photo (undefined/null → initials fallback).
  author_avatar_url: z.string().nullable().optional(),
  // Omit for a top-level announcement; set to a top-level id to reply (one level).
  parent_id: z.number().optional(),
  // Trip user ids the author @-mentioned in the body. The client resolves these
  // from its member list at compose time; the server maps them to Clerk accounts
  // and pushes each a "mentioned you" notification (deduped against the post's
  // other recipients). Non-members simply don't resolve and are ignored.
  mentioned_user_ids: z.array(z.number()).optional(),
});

export const ToggleReactionBodySchema = z.object({
  user_id: z.number(),
  emoji: z.enum(ANNOUNCEMENT_REACTIONS),
});
