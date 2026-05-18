import { Hono } from "hono";
import type { Env } from "../types";
import { getTripDO } from "../do";

export const tripRoutes = new Hono<{ Bindings: Env }>();

tripRoutes.get("/api/trip", async (c) => {
  const stub = getTripDO(c.env);
  const trip = await stub.getTrip();
  return c.json(trip);
});

tripRoutes.post("/api/trip", async (c) => {
  const stub = getTripDO(c.env);
  const body = await c.req.json();
  try {
    const result = await stub.createTrip(body);
    return c.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Trip already exists") {
      return c.json({ detail: msg }, 409);
    }
    return c.json({ detail: msg }, 400);
  }
});
