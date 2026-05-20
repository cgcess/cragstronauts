import { Hono } from "hono";
import type { Env } from "../types";
import { getTripDO } from "../do";

export const gearRoutes = new Hono<{ Bindings: Env }>();

// Gear categories
gearRoutes.get("/api/gear-categories", async (c) => {
  const stub = getTripDO(c.env);
  const categories = await stub.listCategories();
  return c.json(categories);
});

gearRoutes.post("/api/gear-categories", async (c) => {
  const stub = getTripDO(c.env);
  const body = await c.req.json();
  const cat = await stub.addCategory(body);
  return c.json(cat);
});

gearRoutes.delete("/api/gear-categories/:cat_id", async (c) => {
  const stub = getTripDO(c.env);
  const catId = Number(c.req.param("cat_id"));
  const result = await stub.deleteCategory(catId);
  return c.json(result);
});

// Gear contributions
gearRoutes.get("/api/gear", async (c) => {
  const stub = getTripDO(c.env);
  const gear = await stub.listGear();
  return c.json(gear);
});

gearRoutes.post("/api/gear", async (c) => {
  const stub = getTripDO(c.env);
  const body = await c.req.json();
  const contrib = await stub.addGear(body);
  return c.json(contrib);
});

gearRoutes.delete("/api/gear/:contrib_id", async (c) => {
  const stub = getTripDO(c.env);
  const contribId = Number(c.req.param("contrib_id"));
  const result = await stub.deleteGear(contribId);
  return c.json(result);
});
