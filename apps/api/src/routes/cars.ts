import { OpenAPIHono } from "@hono/zod-openapi";
import type { Env } from "../types";
import { getTripDO, getAccountDO } from "../do";
import { trackTripEvent } from "../events";
import { sendPushToAccount } from "../push";
import {
  listCarsRoute,
  createCarRoute,
  deleteCarRoute,
  carSignupRoute,
  carSignoffRoute,
  listDogsRoute,
  createDogRoute,
  deleteDogRoute,
  assignDogRoute,
  unassignDogRoute,
} from "@cragstronauts/contract";

export const carRoutes = new OpenAPIHono<{ Bindings: Env }>();

carRoutes.openapi(listCarsRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const stub = getTripDO(c.env, tripId);
  const cars = await stub.listCars();
  return c.json([...cars], 200);
});

carRoutes.openapi(createCarRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const car = await stub.createCar(body);
    trackTripEvent(c.env, (p) => c.executionCtx.waitUntil(p), stub, ({ tripName }) => ({
      type: "car_created",
      tripName,
      driverName: car.driver_name,
    }));
    return c.json(car, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

carRoutes.openapi(deleteCarRoute, async (c) => {
  const { trip_id: tripId, car_id } = c.req.valid("param");
  const carId = Number(car_id);
  const stub = getTripDO(c.env, tripId);
  const result = await stub.deleteCar(carId);
  trackTripEvent(c.env, (p) => c.executionCtx.waitUntil(p), stub, ({ tripName }) => ({
    type: "car_deleted",
    tripName,
  }));
  return c.json(result, 200);
});

carRoutes.openapi(carSignupRoute, async (c) => {
  const { trip_id: tripId, car_id } = c.req.valid("param");
  const carId = Number(car_id);
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const { car, passengerName } = await stub.carSignup(carId, body.user_id, body.from_reserved);
    trackTripEvent(c.env, (p) => c.executionCtx.waitUntil(p), stub, ({ tripName }) => ({
      type: "car_seat_taken",
      tripName,
      passengerName,
      driverName: car.driver_name,
    }));
    // Tell the driver a passenger hopped in. The DO already rejects the driver
    // joining their own car, so there's no self-notify to guard against. Push is
    // account-scoped: resolve the driver's Clerk account and fan out to its
    // devices. A cooperative public-trip driver (no account) is a silent no-op.
    const driverAccountId = await stub.getUserAccountId(car.driver_user_id);
    if (driverAccountId) {
      sendPushToAccount(
        c.env,
        (p) => c.executionCtx.waitUntil(p),
        getAccountDO(c.env, driverAccountId),
        tripId,
        {
          title: "Someone joined your car",
          body: `${passengerName} hopped into your car`,
          url: `/trips/${tripId}/board`,
        },
      );
    }
    return c.json(car, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Car not found") {
      return c.json({ detail: msg }, 404);
    }
    return c.json({ detail: msg }, 400);
  }
});

carRoutes.openapi(carSignoffRoute, async (c) => {
  const { trip_id: tripId, car_id, user_id } = c.req.valid("param");
  const carId = Number(car_id);
  const userId = Number(user_id);
  try {
    const stub = getTripDO(c.env, tripId);
    const car = await stub.carSignoff(carId, userId);
    trackTripEvent(c.env, (p) => c.executionCtx.waitUntil(p), stub, ({ tripName, users }) => ({
      type: "car_seat_vacated",
      tripName,
      passengerName: users.find((u) => u.id === userId)?.name ?? null,
      driverName: car.driver_name,
    }));
    return c.json(car, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Car not found") {
      return c.json({ detail: msg }, 404);
    }
    return c.json({ detail: msg }, 400);
  }
});

carRoutes.openapi(listDogsRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const stub = getTripDO(c.env, tripId);
  const dogs = await stub.listDogs();
  return c.json([...dogs], 200);
});

carRoutes.openapi(createDogRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const dog = await stub.createDog(body.owner_user_id, body.name);
    trackTripEvent(c.env, (p) => c.executionCtx.waitUntil(p), stub, ({ tripName }) => ({
      type: "dog_added",
      tripName,
      dogName: dog.name,
      ownerName: dog.owner_name,
    }));
    return c.json(dog, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

carRoutes.openapi(deleteDogRoute, async (c) => {
  const { trip_id: tripId, dog_id } = c.req.valid("param");
  const dogId = Number(dog_id);
  const stub = getTripDO(c.env, tripId);
  const result = await stub.deleteDog(dogId);
  trackTripEvent(c.env, (p) => c.executionCtx.waitUntil(p), stub, ({ tripName }) => ({
    type: "dog_removed",
    tripName,
  }));
  return c.json(result, 200);
});

carRoutes.openapi(assignDogRoute, async (c) => {
  const { trip_id: tripId, car_id } = c.req.valid("param");
  const carId = Number(car_id);
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const car = await stub.assignDog(carId, body.dog_id);
    trackTripEvent(c.env, (p) => c.executionCtx.waitUntil(p), stub, ({ tripName }) => ({
      type: "dog_assigned_to_car",
      tripName,
      dogName: car.dogs.find((d) => d.dog_id === body.dog_id)?.name ?? null,
      driverName: car.driver_name,
    }));
    return c.json(car, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Car not found") {
      return c.json({ detail: msg }, 404);
    }
    return c.json({ detail: msg }, 400);
  }
});

carRoutes.openapi(unassignDogRoute, async (c) => {
  const { trip_id: tripId, car_id, dog_id } = c.req.valid("param");
  const carId = Number(car_id);
  const dogId = Number(dog_id);
  try {
    const stub = getTripDO(c.env, tripId);
    const car = await stub.unassignDog(carId, dogId);
    trackTripEvent(c.env, (p) => c.executionCtx.waitUntil(p), stub, async ({ tripName }) => {
      const dogs = await stub.listDogs();
      return {
        type: "dog_unassigned_from_car",
        tripName,
        dogName: dogs.find((d) => d.id === dogId)?.name ?? null,
        driverName: car.driver_name,
      };
    });
    return c.json(car, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Car not found") {
      return c.json({ detail: msg }, 404);
    }
    return c.json({ detail: msg }, 400);
  }
});
