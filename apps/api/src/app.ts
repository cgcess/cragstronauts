import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { tripRoutes } from "./routes/trip";
import { userRoutes } from "./routes/users";
import { gearRoutes } from "./routes/gear";
import { carRoutes } from "./routes/cars";
import { expenseRoutes } from "./routes/expenses";
import { feedbackRoutes } from "./routes/feedback";

export const createApp = () => {
  const app = new OpenAPIHono<{ Bindings: Env }>();

  app.use("/api/*", cors({ origin: "*" }));

  app.route("/", tripRoutes);
  app.route("/", userRoutes);
  app.route("/", gearRoutes);
  app.route("/", carRoutes);
  app.route("/", expenseRoutes);
  app.route("/", feedbackRoutes);

  return app;
};
