import { Hono } from "hono";
import type { Env } from "../types";
import { getTripDO } from "../do";

export const gearRoutes = new Hono<{ Bindings: Env }>();

// Gear categories
gearRoutes.get("/api/trips/:trip_id/gear-categories", async (c) => {
  const stub = getTripDO(c.env, c.req.param("trip_id"));
  const categories = await stub.listCategories();
  return c.json(categories);
});

gearRoutes.post("/api/trips/:trip_id/gear-categories", async (c) => {
  const stub = getTripDO(c.env, c.req.param("trip_id"));
  const body = await c.req.json();
  const cat = await stub.addCategory(body);
  return c.json(cat);
});

gearRoutes.delete("/api/trips/:trip_id/gear-categories/:cat_id", async (c) => {
  const stub = getTripDO(c.env, c.req.param("trip_id"));
  const catId = Number(c.req.param("cat_id"));
  const result = await stub.deleteCategory(catId);
  return c.json(result);
});

// Gear contributions
gearRoutes.get("/api/trips/:trip_id/gear", async (c) => {
  const stub = getTripDO(c.env, c.req.param("trip_id"));
  const gear = await stub.listGear();
  return c.json(gear);
});

gearRoutes.post("/api/trips/:trip_id/gear", async (c) => {
  const stub = getTripDO(c.env, c.req.param("trip_id"));
  const body = await c.req.json();
  try {
    const contrib = await stub.addGear(body);
    return c.json(contrib);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

gearRoutes.delete("/api/trips/:trip_id/gear/:contrib_id", async (c) => {
  const stub = getTripDO(c.env, c.req.param("trip_id"));
  const contribId = Number(c.req.param("contrib_id"));
  const result = await stub.deleteGear(contribId);
  return c.json(result);
});
