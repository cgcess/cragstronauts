import type { TripDO } from "./TripDO";
import type { TripIndexDO } from "./TripIndexDO";
import type { AccountDO } from "./AccountDO";
import type { Env } from "./types";

/** Get a TripDO stub by its hex ID. Throws a clear error for malformed IDs. */
export function getTripDO(env: Env, tripId: string) {
  if (!/^[0-9a-f]{64}$/i.test(tripId)) {
    throw new Error("Trip not found");
  }
  return env.TRIP_DO.get(env.TRIP_DO.idFromString(tripId)) as DurableObjectStub<TripDO>;
}

/** Get the single global TripIndexDO stub. */
export function getTripIndexDO(env: Env) {
  return env.TRIP_INDEX.get(env.TRIP_INDEX.idFromName("global")) as DurableObjectStub<TripIndexDO>;
}

/** Get the per-account AccountDO stub (the account's owned + joined list). */
export function getAccountDO(env: Env, accountId: string) {
  return env.ACCOUNT_DO.get(
    env.ACCOUNT_DO.idFromName(accountId)
  ) as DurableObjectStub<AccountDO>;
}
