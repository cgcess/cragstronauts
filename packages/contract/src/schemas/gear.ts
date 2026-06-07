import { z } from "zod";
import { GearCategoryFieldSchema } from "./trip";

export const GearCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  fields: z.array(GearCategoryFieldSchema),
  summary_mode: z.enum(["people", "total"]),
});

export const AddGearCategoryBodySchema = z.object({
  name: z.string().min(1),
  fields: z.array(GearCategoryFieldSchema),
  summary_mode: z.enum(["people", "total"]).optional(),
});

export const UpdateGearCategoryBodySchema = z.object({
  name: z.string().min(1).optional(),
  fields: z.array(GearCategoryFieldSchema).optional(),
  summary_mode: z.enum(["people", "total"]).optional(),
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
