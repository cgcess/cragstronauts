import { OpenAPIHono } from "@hono/zod-openapi";
import type { Env } from "../types";
import { getTripDO } from "../do";
import {
  listCategoriesRoute,
  addCategoryRoute,
  updateCategoryRoute,
  deleteCategoryRoute,
  listGearRoute,
  addGearRoute,
  deleteGearRoute,
  listGearDeclinesRoute,
  addGearDeclineRoute,
  deleteGearDeclineRoute,
} from "@cragstronauts/contract";

export const gearRoutes = new OpenAPIHono<{ Bindings: Env }>();

// Gear categories
gearRoutes.openapi(listCategoriesRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const stub = getTripDO(c.env, tripId);
  const categories = await stub.listCategories();
  return c.json([...categories], 200);
});

gearRoutes.openapi(addCategoryRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const body = c.req.valid("json");
  const stub = getTripDO(c.env, tripId);
  const cat = await stub.addCategory(body);
  return c.json(cat, 200);
});

gearRoutes.openapi(updateCategoryRoute, async (c) => {
  const { trip_id: tripId, cat_id } = c.req.valid("param");
  const catId = Number(cat_id);
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const cat = await stub.updateCategory(catId, body);
    return c.json(cat, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

gearRoutes.openapi(deleteCategoryRoute, async (c) => {
  const { trip_id: tripId, cat_id } = c.req.valid("param");
  const catId = Number(cat_id);
  const stub = getTripDO(c.env, tripId);
  const result = await stub.deleteCategory(catId);
  return c.json(result, 200);
});

// Gear contributions
gearRoutes.openapi(listGearRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const stub = getTripDO(c.env, tripId);
  const gear = await stub.listGear();
  return c.json([...gear], 200);
});

gearRoutes.openapi(addGearRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const contrib = await stub.addGear(body);
    return c.json(contrib, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

gearRoutes.openapi(deleteGearRoute, async (c) => {
  const { trip_id: tripId, contrib_id } = c.req.valid("param");
  const contribId = Number(contrib_id);
  const stub = getTripDO(c.env, tripId);
  const result = await stub.deleteGear(contribId);
  return c.json(result, 200);
});

// Gear declines ("not bringing one")
gearRoutes.openapi(listGearDeclinesRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const stub = getTripDO(c.env, tripId);
  const declines = await stub.listGearDeclines();
  return c.json([...declines], 200);
});

gearRoutes.openapi(addGearDeclineRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const decline = await stub.addGearDecline(body);
    return c.json(decline, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

gearRoutes.openapi(deleteGearDeclineRoute, async (c) => {
  const { trip_id: tripId, decline_id } = c.req.valid("param");
  const declineId = Number(decline_id);
  const stub = getTripDO(c.env, tripId);
  const result = await stub.deleteGearDecline(declineId);
  return c.json(result, 200);
});
