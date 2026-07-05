import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { clerkMiddleware } from "@clerk/hono";
import type { Env } from "./types";
import { tripRoutes } from "./routes/trip";
import { userRoutes } from "./routes/users";
import { gearRoutes } from "./routes/gear";
import { pollRoutes } from "./routes/poll";
import { carRoutes } from "./routes/cars";
import { expenseRoutes } from "./routes/expenses";
import { feedbackRoutes } from "./routes/feedback";
import { createClerkWebhookRoute } from "./routes/clerk-webhook";
import { tripAccess } from "./middleware/tripAccess";
import { broadcastOnMutation } from "./middleware/broadcast";

export const createApp = () => {
  const app = new OpenAPIHono<{ Bindings: Env }>();

  app.use("/api/*", cors({ origin: "*" }));

  // Populate Clerk auth on every API request. Clerk is required: the keys
  // (CLERK_SECRET_KEY / CLERK_PUBLISHABLE_KEY) must be set. getAccountId then
  // returns the signed-in account, or null when the caller is signed out.
  app.use("/api/*", clerkMiddleware());

  // Unauthenticated version marker — curl it during a rollout to confirm which
  // deployed version served the request (and thus when promotion hit 100%).
  app.get("/api/version", (c) => c.json(c.env.CF_VERSION_METADATA));

  // Privacy gate for every trip sub-route. The wildcard matches both the bare
  // "/api/trips/:trip_id" (the summary read) and every sub-path, but not the
  // "/api/trips" list/create routes (those gate sign-in in their handlers).
  app.use("/api/trips/:trip_id/*", tripAccess);

  // After a successful mutation, broadcast a "changed" signal to connected
  // viewers of this trip. Registered after tripAccess so it only runs once the
  // request is authorized.
  app.use("/api/trips/:trip_id/*", broadcastOnMutation);

  app.route("/", tripRoutes);
  app.route("/", userRoutes);
  app.route("/", gearRoutes);
  app.route("/", pollRoutes);
  app.route("/", carRoutes);
  app.route("/", expenseRoutes);
  app.route("/", feedbackRoutes);

  app.route("/", createClerkWebhookRoute());

  return app;
};
