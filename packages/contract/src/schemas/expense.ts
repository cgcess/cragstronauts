import { z } from "zod";

export const ExpenseSplitMemberSchema = z.object({
  user_id: z.number(),
  name: z.string(),
});

export const ExpenseSchema = z.object({
  id: z.number(),
  payer_user_id: z.number(),
  payer_name: z.string(),
  amount_cents: z.number(),
  description: z.string(),
  created_at: z.string(),
  splits: z.array(ExpenseSplitMemberSchema),
});

export const CreateExpenseBodySchema = z.object({
  payer_user_id: z.number(),
  amount_cents: z.number().int().min(1),
  description: z.string().min(1),
  split_user_ids: z.array(z.number()).min(1),
});

export const SettlementSchema = z.object({
  from_user_id: z.number(),
  from_name: z.string(),
  to_user_id: z.number(),
  to_name: z.string(),
  amount_cents: z.number(),
});
