import { z } from "zod";

export const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  joining: z.boolean(),
  is_organizer: z.boolean(),
  signup_completed: z.boolean(),
  claimed: z.boolean(),
  // Whether this person is bound to a Google account (the raw account id is
  // never exposed). False is the cooperative-identity default.
  linked: z.boolean(),
});

// Resolves "which trip user is the signed-in account" — null when not signed
// in or not yet linked on this trip.
export const MyTripUserSchema = z.object({
  user_id: z.number().nullable(),
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
