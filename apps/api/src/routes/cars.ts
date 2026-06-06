import { OpenAPIHono } from "@hono/zod-openapi";
import type { Env } from "../types";
import { getTripDO } from "../do";
import {
  listCarsRoute,
  createCarRoute,
  deleteCarRoute,
  carSignupRoute,
  carSignoffRoute,
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
  return c.json(result, 200);
});

carRoutes.openapi(carSignupRoute, async (c) => {
  const { trip_id: tripId, car_id } = c.req.valid("param");
  const carId = Number(car_id);
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const car = await stub.carSignup(carId, body.user_id, body.from_reserved);
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
    return c.json(car, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Car not found") {
      return c.json({ detail: msg }, 404);
    }
    return c.json({ detail: msg }, 400);
  }
});
