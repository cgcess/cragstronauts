import { z } from "zod";

export const ExpenseSplitMemberSchema = z.object({
  user_id: z.number(),
  name: z.string(),
  amount_cents: z.number().nullable().optional(),
});

export const ExpenseSchema = z.object({
  id: z.number(),
  payer_user_id: z.number(),
  payer_name: z.string(),
  amount_cents: z.number(),
  description: z.string(),
  created_at: z.string(),
  is_settlement: z.boolean(),
  splits: z.array(ExpenseSplitMemberSchema),
});

export const CreateExpenseBodySchema = z.discriminatedUnion("split_mode", [
  z.object({
    payer_user_id: z.number(),
    amount_cents: z.number().int().min(1),
    description: z.string().min(1),
    split_mode: z.literal("equal"),
    split_user_ids: z.array(z.number()).min(1),
    is_settlement: z.boolean().optional(),
  }),
  z.object({
    payer_user_id: z.number(),
    amount_cents: z.number().int().min(1),
    description: z.string().min(1),
    split_mode: z.literal("custom"),
    splits: z.array(
      z.object({
        user_id: z.number(),
        amount_cents: z.number().int().min(0),
      })
    ).min(1),
    is_settlement: z.boolean().optional(),
  }),
]);

/** Backwards-compatible body: accepts old format (no split_mode) as equal. */
export const CreateExpenseBodyCompatSchema = z.union([
  CreateExpenseBodySchema,
  z.object({
    payer_user_id: z.number(),
    amount_cents: z.number().int().min(1),
    description: z.string().min(1),
    split_user_ids: z.array(z.number()).min(1),
  }),
]);

/** Update body — same shape as create (full replacement semantics). */
export const UpdateExpenseBodySchema = CreateExpenseBodySchema;

export const SettlementSchema = z.object({
  from_user_id: z.number(),
  from_name: z.string(),
  to_user_id: z.number(),
  to_name: z.string(),
  amount_cents: z.number(),
});


