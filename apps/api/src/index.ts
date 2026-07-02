import { createApp } from "./app";
import type { Env } from "./types";

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    return createApp().fetch(req, env, ctx);
  },
};

export { TripDO } from "./TripDO";
export { TripIndexDO } from "./TripIndexDO";
export { AccountIndexDO } from "./AccountIndexDO";
