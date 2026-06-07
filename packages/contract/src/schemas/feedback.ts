import { z } from "zod";

export const FeedbackSchema = z.object({
  id: z.number(),
  user_id: z.number().nullable(),
  author_name: z.string(),
  body: z.string(),
  anonymous: z.boolean(),
  created_at: z.string(),
});

export const CreateFeedbackBodySchema = z.object({
  user_id: z.number(),
  body: z.string().min(1).max(2000),
  anonymous: z.boolean().optional(),
});

// Only the organizer may list feedback — the requester identifies themselves
// via this query param so the API can verify they're the organizer.
export const ListFeedbackQuerySchema = z.object({
  user_id: z.string(),
});
