import { z } from "zod";

export const ErrorSchema = z.object({
  detail: z.string(),
});

export const OkSchema = z.object({
  ok: z.boolean(),
});
