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

    // Notify by push. @-mentions come first with the most specific message, then
    // the default recipients (a top-level post → every member; a reply → the
    // parent author) fill in — deduped so nobody gets two pushes and the author
    // never self-notifies. Push is account-scoped, so members with no account
    // are silent no-ops.
    const authorAccount = getAccountId(c);
    const schedule = (p: Promise<unknown>) => c.executionCtx.waitUntil(p);
    const notified = new Set<string>();
    const notify = (account: string | null, title: string) => {
      if (!account || account === authorAccount || notified.has(account)) return;
      notified.add(account);
      sendPushToAccount(c.env, schedule, getAccountDO(c.env, account), tripId, {
        title,
        body: preview(created.body),
        url: `/trips/${tripId}/board`,
      });
    };

    if (body.mentioned_user_ids?.length) {
      const accounts = await stub.accountIdsForUsers(body.mentioned_user_ids);
      for (const account of accounts) {
        notify(account, `${created.author_name} mentioned you`);
      }
    }

    if (isReply) {
      const parent = await stub.getAnnouncementMeta(body.parent_id!);
      if (parent?.user_id != null) {
        notify(
          await stub.getUserAccountId(parent.user_id),
          `${created.author_name} replied to your announcement`,
        );
      }
    } else if (body.car_id != null) {
      const carUserIds = await stub.carMemberUserIds(body.car_id);
      const accounts = await stub.accountIdsForUsers(carUserIds);
      for (const account of accounts) {
        notify(account, `${created.author_name} posted to your car`);
      }
    } else {
      for (const account of await stub.memberAccountIds()) {
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
