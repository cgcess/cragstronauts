import { z } from "zod";

export const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  joining: z.boolean(),
  is_organizer: z.boolean(),
  signup_completed: z.boolean(),
  claimed: z.boolean(),
});

export const CreateUserBodySchema = z.object({
  name: z.string().min(1),
  joining: z.boolean(),
  claimed: z.boolean().optional(),
});

export const UpdateUserBodySchema = z.object({
  name: z.string().optional(),
  joining: z.boolean().optional(),
});
