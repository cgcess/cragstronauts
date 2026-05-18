import { DurableObject } from "cloudflare:workers";
import { migrate, createDb, eq, type Database } from "do-orm";
import type { Env } from "./types";
import { migrations } from "./db/migrations";
import {
  trip,
  user,
  gearCategory,
  car,
  carSignup,
  gearContribution,
} from "./db/schema";

export class TripDO extends DurableObject<Env> {
  db: Database;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.db = createDb(ctx.storage);

    ctx.blockConcurrencyWhile(async () => {
      migrate(ctx.storage, migrations);
      ctx.storage.sql.exec("PRAGMA foreign_keys = ON");
    });
  }

  // ---- Trip ----

  async getTrip(): Promise<Record<string, unknown> | null> {
    const row = this.db.get(trip, { where: eq("id", 1) });
    return row ?? null;
  }

  async createTrip(data: {
    location: string;
    start_date: string | null;
    end_date: string | null;
    accommodation_type: string | null;
    accommodation_details: string | null;
    notes: string | null;
    gear_categories: {
      name: string;
      fields: { key: string; label: string; type: string }[];
    }[];
    organizer_name: string;
  }): Promise<{ trip_id: number; organizer_user_id: number }> {
    const existing = this.db.get(trip, { where: eq("id", 1) });
    if (existing) throw new Error("Trip already exists");

    this.db.insert(trip, {
      id: 1,
      location: data.location,
      start_date: data.start_date,
      end_date: data.end_date,
      accommodation_type: data.accommodation_type,
      accommodation_details: data.accommodation_details,
      notes: data.notes,
    });

    for (const cat of data.gear_categories) {
      if (!cat.name?.trim()) continue;
      const fields = cat.fields.filter(
        (f) => f.key?.trim() && f.label?.trim()
      );
      this.db.insert(gearCategory, {
        trip_id: 1,
        name: cat.name.trim(),
        fields: JSON.stringify(fields),
      });
    }

    const userRow = this.db.insertReturning(
      user,
      {
        trip_id: 1,
        name: data.organizer_name,
        joining: 1,
        is_organizer: 1,
      },
      ["id"]
    );

    return { trip_id: 1, organizer_user_id: userRow.id };
  }

  // ---- Users ----

  async listUsers(): Promise<Record<string, unknown>[]> {
    return this.db.all(user, { where: eq("trip_id", 1) }).map(formatUser);
  }

  async createUser(data: {
    name: string;
    joining: boolean;
  }): Promise<Record<string, unknown>> {
    const name = data.name.trim();
    if (!name) throw new Error("Name required");

    const t = this.db.get(trip, { where: eq("id", 1) });
    if (!t) throw new Error("Trip not configured yet");

    const row = this.db.insertReturning(
      user,
      { trip_id: 1, name, joining: data.joining ? 1 : 0 },
      ["id", "name", "joining", "is_organizer"]
    );
    return formatUser(row);
  }

  async updateUser(
    userId: number,
    data: { name?: string; joining?: boolean }
  ): Promise<Record<string, unknown>> {
    const row = this.db.get(user, { where: eq("id", userId) });
    if (!row) throw new Error("User not found");

    const newName =
      data.name !== undefined ? data.name.trim() : row.name;
    if (!newName) throw new Error("Name cannot be empty");
    const newJoining =
      data.joining !== undefined ? (data.joining ? 1 : 0) : row.joining;

    this.db.update(user, { name: newName, joining: newJoining }, {
      where: eq("id", userId),
    });

    const updated = this.db.get(user, { where: eq("id", userId) })!;
    return formatUser(updated);
  }

  // ---- Gear Categories ----

  async listCategories(): Promise<Record<string, unknown>[]> {
    return this.db
      .all(gearCategory, { where: eq("trip_id", 1) })
      .map(formatCategory);
  }

  async addCategory(data: {
    name: string;
    fields: { key: string; label: string; type: string }[];
  }): Promise<Record<string, unknown>> {
    const row = this.db.insertReturning(
      gearCategory,
      { trip_id: 1, name: data.name, fields: JSON.stringify(data.fields) },
      ["id", "name", "fields"]
    );
    return formatCategory(row);
  }

  async deleteCategory(catId: number): Promise<{ ok: boolean }> {
    this.db.delete(gearCategory, { where: eq("id", catId) });
    return { ok: true };
  }

  // ---- Cars ----

  async listCars(): Promise<Record<string, unknown>[]> {
    const rows = this.db.all(car, { where: eq("trip_id", 1) });
    return rows.map((r) => this.formatCar(r));
  }

  async createCar(data: {
    driver_user_id: number;
    total_seats: number;
    notes: string | null;
  }): Promise<Record<string, unknown>> {
    if (data.total_seats < 1) throw new Error("total_seats must be >= 1");

    const existing = this.db.get(car, {
      where: eq("driver_user_id", data.driver_user_id),
    });

    let carId: number;
    if (existing) {
      this.db.update(
        car,
        { total_seats: data.total_seats, notes: data.notes },
        { where: eq("id", existing.id) }
      );
      carId = existing.id;
    } else {
      const row = this.db.insertReturning(
        car,
        {
          trip_id: 1,
          driver_user_id: data.driver_user_id,
          total_seats: data.total_seats,
          notes: data.notes,
        },
        ["id"]
      );
      carId = row.id;
    }

    const c = this.db.get(car, { where: eq("id", carId) })!;
    return this.formatCar(c);
  }

  async deleteCar(carId: number): Promise<{ ok: boolean }> {
    this.db.delete(car, { where: eq("id", carId) });
    return { ok: true };
  }

  async carSignup(
    carId: number,
    userId: number
  ): Promise<Record<string, unknown>> {
    const c = this.db.get(car, { where: eq("id", carId) });
    if (!c) throw new Error("Car not found");

    const taken = this.db.count(carSignup, { where: eq("car_id", carId) });
    const capacity = Math.max(0, c.total_seats - 1);
    if (taken >= capacity) throw new Error("Car is full");
    if (userId === c.driver_user_id)
      throw new Error("Driver is already in the car");

    try {
      this.db.insert(carSignup, { car_id: carId, user_id: userId });
    } catch {
      throw new Error("Already signed up");
    }

    const updated = this.db.get(car, { where: eq("id", carId) })!;
    return this.formatCar(updated);
  }

  async carSignoff(
    carId: number,
    userId: number
  ): Promise<Record<string, unknown>> {
    // Use raw SQL for compound WHERE since do-orm eq() is single-column
    this.db.raw(
      "DELETE FROM car_signup WHERE car_id = ? AND user_id = ?",
      [carId, userId]
    );

    const c = this.db.get(car, { where: eq("id", carId) });
    if (!c) throw new Error("Car not found");
    return this.formatCar(c);
  }

  // ---- Gear Contributions ----

  async listGear(): Promise<Record<string, unknown>[]> {
    const rows = this.db.all(gearContribution, {
      where: eq("trip_id", 1),
    });
    return rows.map((r) => this.formatContribution(r));
  }

  async addGear(data: {
    user_id: number;
    category_id: number;
    details: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    const row = this.db.insertReturning(
      gearContribution,
      {
        trip_id: 1,
        user_id: data.user_id,
        category_id: data.category_id,
        details: JSON.stringify(data.details),
      },
      ["id", "user_id", "category_id", "details"]
    );
    return this.formatContribution(row);
  }

  async deleteGear(contribId: number): Promise<{ ok: boolean }> {
    this.db.delete(gearContribution, { where: eq("id", contribId) });
    return { ok: true };
  }

  // ---- Helpers ----

  private formatCar(r: {
    id: number;
    driver_user_id: number;
    total_seats: number;
    notes: string | null;
  }): Record<string, unknown> {
    const driver = this.db.get(user, {
      where: eq("id", r.driver_user_id),
    });

    const passengers = this.db.raw<{ user_id: number; name: string }>(
      `SELECT u.id as user_id, u.name as name
       FROM car_signup cs JOIN user u ON u.id = cs.user_id
       WHERE cs.car_id = ? ORDER BY cs.id`,
      [r.id]
    );

    return {
      id: r.id,
      driver_user_id: r.driver_user_id,
      driver_name: driver ? driver.name : "(unknown)",
      total_seats: r.total_seats,
      notes: r.notes,
      passengers,
    };
  }

  private formatContribution(r: {
    id: number;
    user_id: number;
    category_id: number;
    details: string;
  }): Record<string, unknown> {
    const u = this.db.get(user, { where: eq("id", r.user_id) });
    const cat = this.db.get(gearCategory, {
      where: eq("id", r.category_id),
    });

    return {
      id: r.id,
      user_id: r.user_id,
      user_name: u ? u.name : "(unknown)",
      category_id: r.category_id,
      category_name: cat ? cat.name : "(unknown)",
      details: typeof r.details === "string" ? JSON.parse(r.details) : r.details,
    };
  }
}

function formatUser(r: {
  id: number;
  name: string;
  joining: number;
  is_organizer: number;
}): Record<string, unknown> {
  return {
    id: r.id,
    name: r.name,
    joining: Boolean(r.joining),
    is_organizer: Boolean(r.is_organizer),
  };
}

function formatCategory(r: {
  id: number;
  name: string;
  fields: string;
}): Record<string, unknown> {
  return {
    id: r.id,
    name: r.name,
    fields: typeof r.fields === "string" ? JSON.parse(r.fields) : r.fields,
  };
}
