import { OpenAPIHono } from "@hono/zod-openapi";
import type { Env } from "../types";
import { getTripDO, getTripIndexDO, getAccountIndexDO } from "../do";
import { getAccountId } from "../lib/auth";
import {
  listTripsRoute,
  createTripRoute,
  getTripRoute,
  updateTripRoute,
  deleteTripRoute,
  joinTripRoute,
  legacyTripsRoute,
} from "@cragstronauts/contract";

export const tripRoutes = new OpenAPIHono<{ Bindings: Env }>();

// Sign-in gated here, not by the access middleware (not under :trip_id).
tripRoutes.openapi(listTripsRoute, async (c) => {
  const accountId = getAccountId(c);
  if (!accountId) return c.json({ detail: "Sign in to view your trips" }, 401);
  const trips = await getAccountIndexDO(c.env, accountId).list();
  return c.json([...trips], 200);
});

tripRoutes.openapi(createTripRoute, async (c) => {
  const accountId = getAccountId(c);
  if (!accountId) return c.json({ detail: "Sign in to create a trip" }, 401);
  const body = c.req.valid("json");
  try {
    const id = c.env.TRIP_DO.newUniqueId();
    const tripId = id.toString();
    const stub = c.env.TRIP_DO.get(id) as DurableObjectStub<import("../TripDO").TripDO>;
    const result = await stub.initialize({ ...body, organizer_account_id: accountId });

    await getAccountIndexDO(c.env, accountId).add(tripId, "owner", {
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
    // Fan out fresh meta to every member's index (best-effort).
    const accountIds = await stub.memberAccountIds();
    const meta = {
      name: trip.name,
      location: trip.location,
      start_date: trip.start_date,
      end_date: trip.end_date,
    };
    await Promise.all(
      accountIds.map((a) =>
        getAccountIndexDO(c.env, a).updateMeta(tripId, meta).catch(() => {})
      )
    );
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
    // Private trips are owner-only; public trips have no owner and keep the old
    // cooperative (UI-gated) delete.
    const { isPublic } = await stub.getVisibility();
    if (!isPublic) {
      const accountId = getAccountId(c);
      if (!(await stub.isOwner(accountId))) {
        return c.json({ detail: "Only the trip owner can delete it" }, 403);
      }
    }
    const accountIds = await stub.memberAccountIds();
    await Promise.all(
      accountIds.map((a) => getAccountIndexDO(c.env, a).remove(tripId).catch(() => {}))
    );
    await stub.destroy();
    return c.json({ ok: true }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

// Join a private trip as the signed-in account (idempotent).
tripRoutes.openapi(joinTripRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const accountId = getAccountId(c);
  if (!accountId) return c.json({ detail: "Sign in to join this trip" }, 401);
  try {
    const stub = getTripDO(c.env, tripId);
    const trip = await stub.getTrip();
    if (!trip) return c.json({ detail: "Trip not found" }, 404);

    let displayName = "Climber";
    try {
      const body = (await c.req.json()) as { name?: string };
      if (body?.name?.trim()) displayName = body.name.trim();
    } catch {
      // no/invalid body
    }
    const member = await stub.join(accountId, displayName);
    await getAccountIndexDO(c.env, accountId).add(tripId, "member", {
      name: trip.name,
      location: trip.location,
      start_date: trip.start_date,
      end_date: trip.end_date,
    });
    return c.json(member, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

// Transitional finder over the frozen global index. Remove once ownership is
// assigned to every legacy trip.
tripRoutes.openapi(legacyTripsRoute, async (c) => {
  const accountId = getAccountId(c);
  if (!accountId) return c.json({ detail: "Sign in to browse trips" }, 401);
  const trips = await getTripIndexDO(c.env).listTrips();
  return c.json([...trips], 200);
});
