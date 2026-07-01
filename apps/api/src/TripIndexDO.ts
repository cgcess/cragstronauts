import { DurableObject } from "cloudflare:workers";
import { migrate, createDb, eq, type Database } from "do-orm";
import type { Env } from "./types";
import { indexMigrations } from "./db/index-migrations";
import { tripIndex, tripMember } from "./db/index-schema";
import type { z } from "zod";
import type { TripIndexEntrySchema } from "@cragstronauts/contract";

type TripIndexEntry = z.infer<typeof TripIndexEntrySchema>;

export class TripIndexDO extends DurableObject<Env> {
  db: Database;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.db = createDb(ctx.storage);

    ctx.blockConcurrencyWhile(async () => {
      migrate(ctx.storage, indexMigrations);
    });
  }

  async listTrips(): Promise<TripIndexEntry[]> {
    return this.db.all(tripIndex) as TripIndexEntry[];
  }

  async registerTrip(
    id: string,
    data: { name: string; location: string; start_date: string | null; end_date: string | null }
  ): Promise<void> {
    this.db.insert(tripIndex, {
      id,
      name: data.name,
      location: data.location,
      start_date: data.start_date,
      end_date: data.end_date,
    });
  }

  async unregisterTrip(id: string): Promise<void> {
    this.db.delete(tripIndex, { where: eq("id", id) });
  }

  async registerMember(accountId: string, tripId: string): Promise<void> {
    const rows = this.db.raw<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM trip_member WHERE account_id = ? AND trip_id = ?",
      [accountId, tripId]
    );
    if (rows[0].cnt > 0) return;
    this.db.insert(tripMember, { account_id: accountId, trip_id: tripId });
  }

  async myTrips(accountId: string): Promise<TripIndexEntry[]> {
    return this.db.raw<TripIndexEntry>(
      `SELECT t.id, t.name, t.location, t.start_date, t.end_date
       FROM trip_member m JOIN trip_index t ON m.trip_id = t.id
       WHERE m.account_id = ?`,
      [accountId]
    );
  }

  async updateTrip(
    id: string,
    data: { name: string; location: string; start_date: string | null; end_date: string | null }
  ): Promise<void> {
    this.db.update(
      tripIndex,
      { name: data.name, location: data.location, start_date: data.start_date, end_date: data.end_date },
      { where: eq("id", id) }
    );
  }
}
