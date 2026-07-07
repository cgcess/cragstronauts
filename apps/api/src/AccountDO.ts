import { DurableObject } from "cloudflare:workers";
import { migrate, createDb, eq, type Database } from "do-orm";
import type { NotificationScope } from "@cragstronauts/contract";
import type { Env } from "./types";
import { accountMigrations } from "./db/account-migrations";
import {
  accountTripIndex,
  pushSubscription,
  notificationSettings,
} from "./db/account-schema";

type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

/**
 * Is `tripId`'s trip running today? Inclusive of both endpoints; a null bound is
 * treated as open (unbounded), so a trip with unknown dates always counts as
 * running. ISO `YYYY-MM-DD` strings compare correctly lexicographically.
 */
function isTripRunning(start: string | null, end: string | null): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (start && today < start) return false;
  if (end && today > end) return false;
  return true;
}

type Role = "owner" | "member";
type AccountTripEntry = {
  id: string;
  name: string;
  location: string;
  start_date: string | null;
  end_date: string | null;
  role: Role;
};
type Meta = {
  name: string;
  location: string;
  start_date: string | null;
  end_date: string | null;
};

// One instance per account (idFromName(accountId)). Holds the trips that
// account owns or joined, with denormalized meta so list() is a single read.
export class AccountDO extends DurableObject<Env> {
  db: Database;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.db = createDb(ctx.storage);

    ctx.blockConcurrencyWhile(async () => {
      migrate(ctx.storage, accountMigrations);
    });
  }

  async list(): Promise<AccountTripEntry[]> {
    return this.db.all(accountTripIndex).map((r) => ({
      id: r.trip_id,
      name: r.name,
      location: r.location,
      start_date: r.start_date ?? null,
      end_date: r.end_date ?? null,
      role: r.role as Role,
    }));
  }

  /** Idempotent upsert of a trip entry with its role + meta. */
  async add(tripId: string, role: Role, meta: Meta): Promise<void> {
    const existing = this.db.get(accountTripIndex, { where: eq("trip_id", tripId) });
    if (existing) {
      this.db.update(
        accountTripIndex,
        {
          role,
          name: meta.name,
          location: meta.location,
          start_date: meta.start_date,
          end_date: meta.end_date,
        },
        { where: eq("trip_id", tripId) }
      );
      return;
    }
    this.db.insert(accountTripIndex, {
      trip_id: tripId,
      role,
      name: meta.name,
      location: meta.location,
      start_date: meta.start_date,
      end_date: meta.end_date,
    });
  }

  /**
   * Present the trip as a member without clobbering an existing role.
   * Absent → insert with role "member". Present → refresh meta only (role kept).
   *
   * Used on public-trip loads (via GET .../users/me and .../claim) where a
   * signed-in account is bound to a `user` slot but never went through the
   * private join path. A blind add(..., "member") would downgrade an owner
   * resolving their own slot, so role is preserved when the entry exists.
   */
  async ensureMember(tripId: string, meta: Meta): Promise<void> {
    const existing = this.db.get(accountTripIndex, { where: eq("trip_id", tripId) });
    if (existing) {
      this.db.update(
        accountTripIndex,
        {
          name: meta.name,
          location: meta.location,
          start_date: meta.start_date,
          end_date: meta.end_date,
        },
        { where: eq("trip_id", tripId) }
      );
      return;
    }
    this.db.insert(accountTripIndex, {
      trip_id: tripId,
      role: "member",
      name: meta.name,
      location: meta.location,
      start_date: meta.start_date,
      end_date: meta.end_date,
    });
  }

  /** Refresh only the denormalized meta (role untouched). No-op if absent. */
  async updateMeta(tripId: string, meta: Meta): Promise<void> {
    const existing = this.db.get(accountTripIndex, { where: eq("trip_id", tripId) });
    if (!existing) return;
    this.db.update(
      accountTripIndex,
      {
        name: meta.name,
        location: meta.location,
        start_date: meta.start_date,
        end_date: meta.end_date,
      },
      { where: eq("trip_id", tripId) }
    );
  }

  async remove(tripId: string): Promise<void> {
    this.db.delete(accountTripIndex, { where: eq("trip_id", tripId) });
  }

  // ---- Push subscriptions ----

  /**
   * Upsert a device's push subscription for this account. Idempotent per
   * endpoint: re-subscribing the same device replaces the prior row
   * (delete-then-insert) rather than duplicating.
   */
  async savePushSubscription(sub: PushSub): Promise<{ ok: boolean }> {
    this.db.delete(pushSubscription, { where: eq("endpoint", sub.endpoint) });
    this.db.insert(pushSubscription, {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      created_at: new Date().toISOString(),
    });
    return { ok: true };
  }

  /** Every push subscription registered for this account, across its devices. */
  async listPushSubscriptions(): Promise<PushSub[]> {
    return this.db
      .all(pushSubscription)
      .map((r) => ({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }));
  }

  /** Remove a subscription by endpoint (unsubscribe, or pruning a dead one). */
  async deletePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
    this.db.delete(pushSubscription, { where: eq("endpoint", endpoint) });
    return { ok: true };
  }

  // ---- Notification settings ----

  /** This account's push scope. Defaults to "always" when never set. */
  async getNotificationScope(): Promise<NotificationScope> {
    const row = this.db.get(notificationSettings, { where: eq("id", 1) });
    return (row?.scope as NotificationScope | undefined) ?? "always";
  }

  /** Persist the account's push scope (single-row upsert). */
  async setNotificationScope(scope: NotificationScope): Promise<{ ok: boolean }> {
    const existing = this.db.get(notificationSettings, { where: eq("id", 1) });
    if (existing) {
      this.db.update(notificationSettings, { scope }, { where: eq("id", 1) });
    } else {
      this.db.insert(notificationSettings, { id: 1, scope });
    }
    return { ok: true };
  }

  /**
   * Gate a push for `tripId` against this account's scope. "always" always
   * passes; "trip" passes only while that trip is running today. An unknown trip
   * (not in this account's index) errs toward passing, so we never silently drop
   * a legitimately-scoped push over a missing index row.
   */
  async shouldNotifyForTrip(tripId: string): Promise<boolean> {
    if ((await this.getNotificationScope()) === "always") return true;
    const entry = this.db.get(accountTripIndex, { where: eq("trip_id", tripId) });
    if (!entry) return true;
    return isTripRunning(entry.start_date ?? null, entry.end_date ?? null);
  }
}
