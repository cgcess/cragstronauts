import { DurableObject } from "cloudflare:workers";
import { migrate, createDb, eq, type Database } from "do-orm";
import type { Env } from "./types";
import { indexMigrations } from "./db/index-migrations";
import { tripIndex } from "./db/index-schema";
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
