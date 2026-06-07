import { OpenAPIHono } from "@hono/zod-openapi";
import type { Env } from "../types";
import { getTripDO } from "../do";
import { createFeedbackRoute, listFeedbackRoute } from "@cragstronauts/contract";

export const feedbackRoutes = new OpenAPIHono<{ Bindings: Env }>();

feedbackRoutes.openapi(createFeedbackRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const fb = await stub.createFeedback(body);
    return c.json(fb, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

feedbackRoutes.openapi(listFeedbackRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const { user_id } = c.req.valid("query");
  const stub = getTripDO(c.env, tripId);
  // Only the organizer can read everyone's feedback.
  const isOrganizer = await stub.isOrganizer(Number(user_id));
  if (!isOrganizer) {
    return c.json({ detail: "Only the organizer can view feedback" }, 403);
  }
  const list = await stub.listFeedback();
  return c.json([...list], 200);
});
