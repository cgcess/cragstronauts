import { z } from "zod";

export const PassengerSchema = z.object({
  user_id: z.number(),
  name: z.string(),
});

export const CarSchema = z.object({
  id: z.number(),
  driver_user_id: z.number(),
  driver_name: z.string(),
  total_seats: z.number(),
  notes: z.string().nullable(),
  passengers: z.array(PassengerSchema),
});

export const CreateCarBodySchema = z.object({
  driver_user_id: z.number(),
  total_seats: z.number().min(1),
  notes: z.string().nullable(),
});

export const CarSignupBodySchema = z.object({
  user_id: z.number(),
});
