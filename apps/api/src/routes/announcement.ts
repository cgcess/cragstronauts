import { OpenAPIHono } from "@hono/zod-openapi";
import type { Env } from "../types";
import { getTripDO, getAccountDO } from "../do";
import { getAccountId } from "../lib/auth";
import { trackTripEvent, nameOf } from "../events";
import { sendPushToAccount } from "../push";
import {
  listAnnouncementsRoute,
  createAnnouncementRoute,
  deleteAnnouncementRoute,
  toggleReactionRoute,
} from "@cragstronauts/contract";

export const announcementRoutes = new OpenAPIHono<{ Bindings: Env }>();

/** A short one-line preview of the body for the push notification. */
const preview = (body: string): string =>
  body.length > 120 ? `${body.slice(0, 117)}…` : body;

announcementRoutes.openapi(listAnnouncementsRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const stub = getTripDO(c.env, tripId);
  const announcements = await stub.listAnnouncements();
  return c.json([...announcements], 200);
});

announcementRoutes.openapi(createAnnouncementRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const created = await stub.createAnnouncement(body);
    const isReply = body.parent_id != null;

    trackTripEvent(c.env, (p) => c.executionCtx.waitUntil(p), stub, ({ tripName, users }) => ({
      type: "announcement_posted",
      tripName,
      userName: nameOf(users, body.user_id),
      isReply,
    }));

    // Notify by push. A top-level post fans out to every trip member account
    // except the author; a reply pings only the parent post's author. Push is
    // account-scoped, so cooperative members with no account are silent no-ops.
    const authorAccount = getAccountId(c);
    const schedule = (p: Promise<unknown>) => c.executionCtx.waitUntil(p);
    const notify = (account: string, title: string) =>
      sendPushToAccount(c.env, schedule, getAccountDO(c.env, account), tripId, {
        title,
        body: preview(created.body),
        url: `/trips/${tripId}/board`,
      });

    if (isReply) {
      const parent = await stub.getAnnouncementMeta(body.parent_id!);
      const parentAuthorId = parent?.user_id ?? null;
      if (parentAuthorId != null) {
        const account = await stub.getUserAccountId(parentAuthorId);
        if (account && account !== authorAccount) {
          notify(account, `${created.author_name} replied to your announcement`);
        }
      }
    } else {
      const accounts = await stub.memberAccountIds();
      for (const account of accounts) {
        if (account === authorAccount) continue;
        notify(account, `${created.author_name} posted an announcement`);
      }
    }

    return c.json(created, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

announcementRoutes.openapi(deleteAnnouncementRoute, async (c) => {
  const { trip_id: tripId, announcement_id } = c.req.valid("param");
  const announcementId = Number(announcement_id);
  const { user_id } = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const result = await stub.deleteAnnouncement(announcementId, user_id);
    return c.json(result, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Announcement not found") return c.json({ detail: msg }, 404);
    if (msg === "Not allowed") return c.json({ detail: msg }, 403);
    return c.json({ detail: msg }, 400);
  }
});

announcementRoutes.openapi(toggleReactionRoute, async (c) => {
  const { trip_id: tripId, announcement_id } = c.req.valid("param");
  const announcementId = Number(announcement_id);
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const result = await stub.toggleReaction(announcementId, body);
    return c.json(result, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Announcement not found") return c.json({ detail: msg }, 404);
    return c.json({ detail: msg }, 400);
  }
});
