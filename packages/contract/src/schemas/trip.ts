import { z } from "zod";

export const TripLinkSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
});

export const TripSchema = z.object({
  name: z.string(),
  location: z.string(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  accommodation_type: z.string().nullable(),
  accommodation_details: z.string().nullable(),
  notes: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  place_label: z.string().nullable(),
  welcome_message: z.string().nullable(),
  signature: z.string().nullable(),
  links: z.array(TripLinkSchema).default([]),
});

export const GearCategoryFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.string(),
});

export const CreateTripBodySchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  accommodation_type: z.string().nullable(),
  accommodation_details: z.string().nullable(),
  notes: z.string().nullable(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  place_label: z.string().nullable().optional(),
  welcome_message: z.string().min(1),
  signature: z.string().min(1),
  links: z.array(TripLinkSchema).optional(),
  gear_categories: z.array(
    z.object({
      name: z.string(),
      fields: z.array(GearCategoryFieldSchema),
      summary_mode: z.enum(["people", "total"]).optional(),
    })
  ),
  polls: z
    .array(
      z.object({
        question: z.string().min(1),
        description: z.string().nullable().optional(),
        emoji: z.string().nullable().optional(),
        options: z
          .array(
            z.object({
              label: z.string().min(1),
              emoji: z.string().nullable().optional(),
            })
          )
          .min(2),
      })
    )
    .optional(),
  organizer_name: z.string().min(1),
});

export const CreateTripResponseSchema = z.object({
  trip_id: z.string(),
  organizer_user_id: z.number(),
});

export const UpdateTripBodySchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  accommodation_type: z.string().nullable().optional(),
  accommodation_details: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  place_label: z.string().nullable().optional(),
  welcome_message: z.string().min(1).optional(),
  signature: z.string().min(1).optional(),
  links: z.array(TripLinkSchema).optional(),
});

export const TripIndexEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
});
