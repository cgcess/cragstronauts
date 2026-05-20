import type { TripDO } from "./TripDO";
import type { Env } from "./types";

/** Get the single TripDO stub (hardcoded name "default"). */
export function getTripDO(env: Env) {
  return env.TRIP_DO.getByName("default") as DurableObjectStub<TripDO>;
}
