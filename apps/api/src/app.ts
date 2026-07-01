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

export const createApp = () => {
  const app = new OpenAPIHono<{ Bindings: Env }>();

  app.use("/api/*", cors({ origin: "*" }));

  // Populate Clerk auth on every API request. Clerk is required: the keys
  // (CLERK_SECRET_KEY / CLERK_PUBLISHABLE_KEY) must be set. getAccountId then
  // returns the signed-in account, or null when the caller is signed out.
  app.use("/api/*", clerkMiddleware());

  app.route("/", tripRoutes);
  app.route("/", userRoutes);
  app.route("/", gearRoutes);
  app.route("/", pollRoutes);
  app.route("/", carRoutes);
  app.route("/", expenseRoutes);
  app.route("/", feedbackRoutes);

  return app;
};
