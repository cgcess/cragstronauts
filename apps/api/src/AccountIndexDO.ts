import { DurableObject } from "cloudflare:workers";
import { migrate, createDb, eq, type Database } from "do-orm";
import type { Env } from "./types";
import { accountIndexMigrations } from "./db/account-index-migrations";
import { accountTripIndex } from "./db/account-index-schema";

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
export class AccountIndexDO extends DurableObject<Env> {
  db: Database;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.db = createDb(ctx.storage);

    ctx.blockConcurrencyWhile(async () => {
      migrate(ctx.storage, accountIndexMigrations);
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
}
