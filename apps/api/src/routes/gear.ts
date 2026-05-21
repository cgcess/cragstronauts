import { Hono } from "hono";
import type { Env } from "../types";
import { getTripDO } from "../do";

export const gearRoutes = new Hono<{ Bindings: Env }>();

// Gear categories
gearRoutes.get("/api/trips/:trip_id/gear-categories", async (c) => {
  const stub = getTripDO(c.env);
  const tripId = Number(c.req.param("trip_id"));
  const categories = await stub.listCategories(tripId);
  return c.json(categories);
});

gearRoutes.post("/api/trips/:trip_id/gear-categories", async (c) => {
  const stub = getTripDO(c.env);
  const tripId = Number(c.req.param("trip_id"));
  const body = await c.req.json();
  const cat = await stub.addCategory(tripId, body);
  return c.json(cat);
});

gearRoutes.delete("/api/gear-categories/:cat_id", async (c) => {
  const stub = getTripDO(c.env);
  const catId = Number(c.req.param("cat_id"));
  const result = await stub.deleteCategory(catId);
  return c.json(result);
});

// Gear contributions
gearRoutes.get("/api/trips/:trip_id/gear", async (c) => {
  const stub = getTripDO(c.env);
  const tripId = Number(c.req.param("trip_id"));
  const gear = await stub.listGear(tripId);
  return c.json(gear);
});

gearRoutes.post("/api/trips/:trip_id/gear", async (c) => {
  const stub = getTripDO(c.env);
  const body = await c.req.json();
  try {
    const contrib = await stub.addGear(body);
    return c.json(contrib);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

gearRoutes.delete("/api/gear/:contrib_id", async (c) => {
  const stub = getTripDO(c.env);
  const contribId = Number(c.req.param("contrib_id"));
  const result = await stub.deleteGear(contribId);
  return c.json(result);
});
