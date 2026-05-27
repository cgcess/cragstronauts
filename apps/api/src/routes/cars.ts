import { Hono } from "hono";
import type { Env } from "../types";
import { getTripDO } from "../do";

export const carRoutes = new Hono<{ Bindings: Env }>();

carRoutes.get("/api/trips/:trip_id/cars", async (c) => {
  const stub = getTripDO(c.env, c.req.param("trip_id"));
  const cars = await stub.listCars();
  return c.json(cars);
});

carRoutes.post("/api/trips/:trip_id/cars", async (c) => {
  const stub = getTripDO(c.env, c.req.param("trip_id"));
  const body = await c.req.json();
  try {
    const car = await stub.createCar(body);
    return c.json(car);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

carRoutes.delete("/api/trips/:trip_id/cars/:car_id", async (c) => {
  const stub = getTripDO(c.env, c.req.param("trip_id"));
  const carId = Number(c.req.param("car_id"));
  const result = await stub.deleteCar(carId);
  return c.json(result);
});

carRoutes.post("/api/trips/:trip_id/cars/:car_id/signup", async (c) => {
  const stub = getTripDO(c.env, c.req.param("trip_id"));
  const carId = Number(c.req.param("car_id"));
  const body = await c.req.json();
  try {
    const car = await stub.carSignup(carId, body.user_id);
    return c.json(car);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Car not found") {
      return c.json({ detail: msg }, 404);
    }
    return c.json({ detail: msg }, 400);
  }
});

carRoutes.delete("/api/trips/:trip_id/cars/:car_id/signup/:user_id", async (c) => {
  const stub = getTripDO(c.env, c.req.param("trip_id"));
  const carId = Number(c.req.param("car_id"));
  const userId = Number(c.req.param("user_id"));
  try {
    const car = await stub.carSignoff(carId, userId);
    return c.json(car);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Car not found") {
      return c.json({ detail: msg }, 404);
    }
    return c.json({ detail: msg }, 400);
  }
});
