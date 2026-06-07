import { OpenAPIHono } from "@hono/zod-openapi";
import type { Env } from "../types";
import { getTripDO, getTripIndexDO } from "../do";
import {
  listTripsRoute,
  createTripRoute,
  getTripRoute,
  updateTripRoute,
  deleteTripRoute,
} from "@cragstronauts/contract";

export const tripRoutes = new OpenAPIHono<{ Bindings: Env }>();

tripRoutes.openapi(listTripsRoute, async (c) => {
  const index = getTripIndexDO(c.env);
  const trips = await index.listTrips();
  return c.json([...trips], 200);
});

tripRoutes.openapi(createTripRoute, async (c) => {
  const body = c.req.valid("json");
  try {
    const id = c.env.TRIP_DO.newUniqueId();
    const tripId = id.toString();
    const stub = c.env.TRIP_DO.get(id) as DurableObjectStub<import("../TripDO").TripDO>;
    const result = await stub.initialize(body);

    const index = getTripIndexDO(c.env);
    await index.registerTrip(tripId, {
      name: body.name,
      location: body.location,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
    });

    return c.json({ trip_id: tripId, organizer_user_id: result.organizer_user_id }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

tripRoutes.openapi(getTripRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const stub = getTripDO(c.env, tripId);
  const trip = await stub.getTrip();
  if (!trip) return c.json({ detail: "Trip not found" }, 404);
  return c.json(trip, 200);
});

tripRoutes.openapi(updateTripRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const trip = await stub.updateTrip(body);
    // Keep the listing index in sync — location/dates power the trip list.
    const index = getTripIndexDO(c.env);
    await index.updateTrip(tripId, {
      name: trip.name,
      location: trip.location,
      start_date: trip.start_date,
      end_date: trip.end_date,
    });
    return c.json(trip, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Trip not found") return c.json({ detail: msg }, 404);
    return c.json({ detail: msg }, 400);
  }
});

tripRoutes.openapi(deleteTripRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  try {
    const stub = getTripDO(c.env, tripId);
    await stub.destroy();
    const index = getTripIndexDO(c.env);
    await index.unregisterTrip(tripId);
    return c.json({ ok: true }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});
