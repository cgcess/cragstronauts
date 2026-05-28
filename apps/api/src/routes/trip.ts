import { Hono } from "hono";
import type { Env } from "../types";
import { getTripDO, getTripIndexDO } from "../do";

export const tripRoutes = new Hono<{ Bindings: Env }>();

tripRoutes.get("/api/trips", async (c) => {
  const index = getTripIndexDO(c.env);
  const trips = await index.listTrips();
  return c.json(trips);
});

tripRoutes.post("/api/trips", async (c) => {
  const body = await c.req.json();
  try {
    const id = c.env.TRIP_DO.newUniqueId();
    const tripId = id.toString();
    const stub = c.env.TRIP_DO.get(id) as DurableObjectStub<import("../TripDO").TripDO>;
    const result = await stub.initialize(body);

    const index = getTripIndexDO(c.env);
    await index.registerTrip(tripId, {
      location: body.location,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
    });

    return c.json({ trip_id: tripId, organizer_user_id: result.organizer_user_id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

tripRoutes.get("/api/trips/:trip_id", async (c) => {
  const tripId = c.req.param("trip_id");
  const stub = getTripDO(c.env, tripId);
  const trip = await stub.getTrip();
  if (!trip) return c.json({ detail: "Trip not found" }, 404);
  return c.json(trip);
});

tripRoutes.patch("/api/trips/:trip_id", async (c) => {
  const tripId = c.req.param("trip_id");
  const body = await c.req.json();
  try {
    const stub = getTripDO(c.env, tripId);
    const trip = await stub.updateTrip(body);
    // Keep the listing index in sync — location/dates power the trip list.
    const index = getTripIndexDO(c.env);
    await index.updateTrip(tripId, {
      location: trip.location as string,
      start_date: (trip.start_date as string | null) ?? null,
      end_date: (trip.end_date as string | null) ?? null,
    });
    return c.json(trip);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Trip not found") return c.json({ detail: msg }, 404);
    return c.json({ detail: msg }, 400);
  }
});

tripRoutes.delete("/api/trips/:trip_id", async (c) => {
  const tripId = c.req.param("trip_id");
  try {
    const stub = getTripDO(c.env, tripId);
    await stub.destroy();
    const index = getTripIndexDO(c.env);
    await index.unregisterTrip(tripId);
    return c.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});
