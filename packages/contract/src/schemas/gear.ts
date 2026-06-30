import { z } from "zod";
import { GearCategoryFieldSchema } from "./trip";

export const GearCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  fields: z.array(GearCategoryFieldSchema),
  summary_mode: z.enum(["people", "total"]),
  // Canonical catalog slug when created from a preset, else null.
  catalog_key: z.string().nullable(),
});

export const AddGearCategoryBodySchema = z.object({
  name: z.string().min(1),
  fields: z.array(GearCategoryFieldSchema),
  summary_mode: z.enum(["people", "total"]).optional(),
  catalog_key: z.string().nullable().optional(),
});

export const UpdateGearCategoryBodySchema = z.object({
  name: z.string().min(1).optional(),
  fields: z.array(GearCategoryFieldSchema).optional(),
  summary_mode: z.enum(["people", "total"]).optional(),
  catalog_key: z.string().nullable().optional(),
});

export const GearContributionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  user_name: z.string(),
  category_id: z.number(),
  category_name: z.string(),
  details: z.record(z.unknown()),
});

export const AddGearBodySchema = z.object({
  user_id: z.number(),
  category_id: z.number(),
  details: z.record(z.unknown()),
});

// A user's explicit "not bringing one" answer for a gear category. Mirrors
// GearContributionSchema but carries no details — it only records the answer.
export const GearDeclineSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  user_name: z.string(),
  category_id: z.number(),
});

export const AddGearDeclineBodySchema = z.object({
  user_id: z.number(),
  category_id: z.number(),
});
