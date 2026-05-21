import { Hono } from "hono";
import type { Env } from "../types";
import { getTripDO } from "../do";

export const tripRoutes = new Hono<{ Bindings: Env }>();

tripRoutes.get("/api/trips", async (c) => {
  const stub = getTripDO(c.env);
  const trips = await stub.listTrips();
  return c.json(trips);
});

tripRoutes.post("/api/trips", async (c) => {
  const stub = getTripDO(c.env);
  const body = await c.req.json();
  try {
    const result = await stub.createTrip(body);
    return c.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

tripRoutes.get("/api/trips/:trip_id", async (c) => {
  const stub = getTripDO(c.env);
  const tripId = Number(c.req.param("trip_id"));
  const trip = await stub.getTrip(tripId);
  if (!trip) return c.json({ detail: "Trip not found" }, 404);
  return c.json(trip);
});

tripRoutes.delete("/api/trips/:trip_id", async (c) => {
  const stub = getTripDO(c.env);
  const tripId = Number(c.req.param("trip_id"));
  try {
    const result = await stub.deleteTrip(tripId);
    return c.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Trip not found") {
      return c.json({ detail: msg }, 404);
    }
    return c.json({ detail: msg }, 400);
  }
});
