import { OpenAPIHono } from "@hono/zod-openapi";
import type { Env } from "../types";
import { getTripDO, getAccountDO } from "../do";
import { getAccountId } from "../lib/auth";
import { trackTripEvent, nameOf } from "../events";
import { sendPushToAccount } from "../push";
import {
  listPollsRoute,
  addPollRoute,
  updatePollRoute,
  deletePollRoute,
  listPollAnswersRoute,
  setPollAnswerRoute,
} from "@cragstronauts/contract";

export const pollRoutes = new OpenAPIHono<{ Bindings: Env }>();

pollRoutes.openapi(listPollsRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const stub = getTripDO(c.env, tripId);
  const polls = await stub.listPolls();
  return c.json([...polls], 200);
});

pollRoutes.openapi(addPollRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const p = await stub.addPoll(body);
    trackTripEvent(c.env, (pr) => c.executionCtx.waitUntil(pr), stub, ({ tripName }) => ({
      type: "poll_added",
      tripName,
      question: p.question,
    }));

    const authorAccount = getAccountId(c);
    const schedule = (pr: Promise<unknown>) => c.executionCtx.waitUntil(pr);
    for (const account of await stub.memberAccountIds()) {
      if (!account || account === authorAccount) continue;
      sendPushToAccount(c.env, schedule, getAccountDO(c.env, account), tripId, {
        title: "New poll",
        body: p.question,
        url: `/trips/${tripId}/board`,
      });
    }

    return c.json(p, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

pollRoutes.openapi(updatePollRoute, async (c) => {
  const { trip_id: tripId, poll_id } = c.req.valid("param");
  const pollId = Number(poll_id);
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const p = await stub.updatePoll(pollId, body);
    return c.json(p, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Poll not found") return c.json({ detail: msg }, 404);
    return c.json({ detail: msg }, 400);
  }
});

pollRoutes.openapi(deletePollRoute, async (c) => {
  const { trip_id: tripId, poll_id } = c.req.valid("param");
  const pollId = Number(poll_id);
  const stub = getTripDO(c.env, tripId);
  const result = await stub.deletePoll(pollId);
  trackTripEvent(c.env, (pr) => c.executionCtx.waitUntil(pr), stub, ({ tripName }) => ({
    type: "poll_removed",
    tripName,
  }));
  return c.json(result, 200);
});

pollRoutes.openapi(listPollAnswersRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const stub = getTripDO(c.env, tripId);
  const answers = await stub.listPollAnswers();
  return c.json([...answers], 200);
});

pollRoutes.openapi(setPollAnswerRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const answers = await stub.setPollAnswer(body);
    trackTripEvent(c.env, (pr) => c.executionCtx.waitUntil(pr), stub, async ({ tripName, users }) => {
      const polls = await stub.listPolls();
      return {
        type: "poll_answered",
        tripName,
        userName: answers[0]?.user_name ?? nameOf(users, body.user_id),
        question: polls.find((poll) => poll.id === body.poll_id)?.question ?? null,
      };
    });
    return c.json([...answers], 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});
