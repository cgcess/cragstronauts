import { z } from "zod";

export const PassengerSchema = z.object({
  user_id: z.number(),
  name: z.string(),
});

export const CarDogSchema = z.object({
  dog_id: z.number(),
  name: z.string(),
  owner_user_id: z.number(),
  owner_name: z.string(),
});

export const DogSchema = z.object({
  id: z.number(),
  name: z.string(),
  owner_user_id: z.number(),
  owner_name: z.string(),
  car_id: z.number().nullable(),
});

export const CarSchema = z.object({
  id: z.number(),
  driver_user_id: z.number(),
  driver_name: z.string(),
  total_seats: z.number(),
  reserved_seats: z.number(),
  notes: z.string().nullable(),
  passengers: z.array(PassengerSchema),
  dogs: z.array(CarDogSchema),
});

export const CreateCarBodySchema = z.object({
  driver_user_id: z.number(),
  total_seats: z.number().min(1),
  reserved_seats: z.number().min(0).optional(),
  notes: z.string().nullable(),
});

export const CarSignupBodySchema = z.object({
  user_id: z.number(),
  from_reserved: z.boolean().optional(),
});

export const CreateDogBodySchema = z.object({
  owner_user_id: z.number(),
  name: z.string().min(1),
});

export const AssignDogBodySchema = z.object({
  dog_id: z.number(),
});
