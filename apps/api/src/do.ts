import type { TripDO } from "./TripDO";
import type { TripIndexDO } from "./TripIndexDO";
import type { Env } from "./types";

/** Get a TripDO stub by its hex ID. */
export function getTripDO(env: Env, tripId: string) {
  return env.TRIP_DO.get(env.TRIP_DO.idFromString(tripId)) as DurableObjectStub<TripDO>;
}

/** Get the single global TripIndexDO stub. */
export function getTripIndexDO(env: Env) {
  return env.TRIP_INDEX.get(env.TRIP_INDEX.idFromName("global")) as DurableObjectStub<TripIndexDO>;
}
