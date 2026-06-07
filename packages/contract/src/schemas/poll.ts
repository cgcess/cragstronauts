import { z } from "zod";

export const PollOptionSchema = z.object({
  id: z.number(),
  label: z.string(),
  emoji: z.string().nullable(),
  position: z.number(),
});

export const PollSchema = z.object({
  id: z.number(),
  question: z.string(),
  description: z.string().nullable(),
  emoji: z.string().nullable(),
  position: z.number(),
  options: z.array(PollOptionSchema),
});

// One row per selected option per user. A user with no rows for a poll is
// "unanswered". Modelled as a list so single-select today can grow to
// multi-select later without reshaping anything.
export const PollAnswerSchema = z.object({
  id: z.number(),
  poll_id: z.number(),
  option_id: z.number(),
  user_id: z.number(),
  user_name: z.string(),
});

// Option input for create/update. An `id` ties the input back to an existing
// row so updates can keep/rename it; omit `id` to create a new option.
const PollOptionInputSchema = z.object({
  id: z.number().optional(),
  label: z.string().min(1),
  emoji: z.string().nullable().optional(),
});

export const CreatePollBodySchema = z.object({
  question: z.string().min(1),
  description: z.string().nullable().optional(),
  emoji: z.string().nullable().optional(),
  options: z.array(PollOptionInputSchema).min(2),
});

export const UpdatePollBodySchema = z.object({
  question: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  emoji: z.string().nullable().optional(),
  // Full reconcile list: options carrying an `id` are kept/renamed, new ones
  // are created, and any existing option absent from the list is deleted
  // (its answers cascade away).
  options: z.array(PollOptionInputSchema).min(2).optional(),
});

// Replace semantics: the user's answers for this poll are set to exactly
// `option_ids`. One id today; many later, with no API change.
export const SetPollAnswerBodySchema = z.object({
  user_id: z.number(),
  poll_id: z.number(),
  option_ids: z.array(z.number()),
});
