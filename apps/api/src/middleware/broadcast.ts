import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";
import { getTripDO } from "../do";

// After a confirmed-successful mutation on a trip sub-route, nudge every
// connected viewer to refetch. One place instead of ~30 routes; fires only on a
// 2xx POST/PATCH/DELETE. Fire-and-forget via waitUntil so a slow or throwing
// broadcast can never affect the mutation response.
export const broadcastOnMutation: MiddlewareHandler<{ Bindings: Env }> = async (
  c,
  next
) => {
  await next();

  const method = c.req.method;
  if (method !== "POST" && method !== "PATCH" && method !== "DELETE") return;
  if (c.res.status < 200 || c.res.status >= 300) return;

  const tripId = c.req.param("trip_id");
  if (!tripId) return;

  const resource = resourceFor(c.req.path, tripId);
  c.executionCtx.waitUntil(
    (async () => {
      try {
        await getTripDO(c.env, tripId).broadcast(resource);
      } catch {
        // A failed broadcast must never surface to the caller.
      }
    })()
  );
};

// The path segment right after `/:trip_id/` (e.g. "cars", "polls"), or
// undefined for the bare trip route. A hint for a later targeted-refetch
// optimization; v1 refetches everything regardless.
function resourceFor(path: string, tripId: string): string | undefined {
  const marker = `/${tripId}/`;
  const i = path.indexOf(marker);
  if (i === -1) return undefined;
  const seg = path.slice(i + marker.length).split("/")[0];
  return seg || undefined;
}
