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

const clerk = clerkMiddleware();

export const createApp = () => {
  const app = new OpenAPIHono<{ Bindings: Env }>();

  app.use("/api/*", cors({ origin: "*" }));

  // Populate Clerk auth on API requests when configured. Auth is additive: with
  // no keys set we skip Clerk and routes behave as the public, cooperative board
  // (getAccountId returns null).
  app.use("/api/*", (c, next) =>
    c.env.CLERK_SECRET_KEY && c.env.CLERK_PUBLISHABLE_KEY ? clerk(c, next) : next()
  );

  app.route("/", tripRoutes);
  app.route("/", userRoutes);
  app.route("/", gearRoutes);
  app.route("/", pollRoutes);
  app.route("/", carRoutes);
  app.route("/", expenseRoutes);
  app.route("/", feedbackRoutes);

  return app;
};
