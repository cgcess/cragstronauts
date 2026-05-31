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
  expense,
  expenseSplit,
} from "./db/schema";
import type { z } from "zod";
import type {
  TripSchema,
  UserSchema,
  GearCategorySchema,
  CarSchema,
  GearContributionSchema,
  ExpenseSchema,
  SettlementSchema,
} from "@cragstronauts/contract";
import { computeSimplifiedBalances } from "./lib/balances";

type Trip = z.infer<typeof TripSchema>;
type User = z.infer<typeof UserSchema>;
type Category = z.infer<typeof GearCategorySchema>;
type Car = z.infer<typeof CarSchema>;
type Contribution = z.infer<typeof GearContributionSchema>;
type Expense = z.infer<typeof ExpenseSchema>;
type Settlement = z.infer<typeof SettlementSchema>;

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

  async getTrip(): Promise<Trip | null> {
    const row = this.db.get(trip, { where: eq("id", 1) });
    return row ? formatTrip(row) : null;
  }

  async initialize(data: {
    location: string;
    start_date: string | null;
    end_date: string | null;
    accommodation_type: string | null;
    accommodation_details: string | null;
    notes: string | null;
    latitude?: number | null;
    longitude?: number | null;
    place_label?: string | null;
    gear_categories: {
      name: string;
      fields: { key: string; label: string; type: string }[];
    }[];
    organizer_name: string;
  }): Promise<{ organizer_user_id: number }> {
    this.db.insert(trip, {
      id: 1,
      location: data.location,
      start_date: data.start_date,
      end_date: data.end_date,
      accommodation_type: data.accommodation_type,
      accommodation_details: data.accommodation_details,
      notes: data.notes,
      latitude: data.latitude != null ? String(data.latitude) : null,
      longitude: data.longitude != null ? String(data.longitude) : null,
      place_label: data.place_label ?? null,
    });

    for (const cat of data.gear_categories) {
      if (!cat.name?.trim()) continue;
      const fields = cat.fields.filter(
        (f) => f.key?.trim() && f.label?.trim()
      );
      this.db.insert(gearCategory, {
        name: cat.name.trim(),
        fields: JSON.stringify(fields),
      });
    }

    const userRow = this.db.insertReturning(
      user,
      {
        name: data.organizer_name,
        joining: 1,
        is_organizer: 1,
        signup_completed: 1,
      },
      ["id"]
    );

    return { organizer_user_id: userRow.id };
  }

  async updateTrip(data: {
    location?: string;
    start_date?: string | null;
    end_date?: string | null;
    accommodation_type?: string | null;
    accommodation_details?: string | null;
    notes?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    place_label?: string | null;
  }): Promise<Trip> {
    const row = this.db.get(trip, { where: eq("id", 1) });
    if (!row) throw new Error("Trip not found");

    const location =
      data.location !== undefined ? data.location.trim() : row.location;
    if (!location) throw new Error("Location required");

    // lat/lon are stored as TEXT; coerce incoming numbers to strings.
    const numToText = (v: number | null | undefined, current: string | null) =>
      v !== undefined ? (v === null ? null : String(v)) : current;

    this.db.update(
      trip,
      {
        location,
        start_date:
          data.start_date !== undefined ? data.start_date : row.start_date,
        end_date: data.end_date !== undefined ? data.end_date : row.end_date,
        accommodation_type:
          data.accommodation_type !== undefined
            ? data.accommodation_type
            : row.accommodation_type,
        accommodation_details:
          data.accommodation_details !== undefined
            ? data.accommodation_details
            : row.accommodation_details,
        notes: data.notes !== undefined ? data.notes : row.notes,
        latitude: numToText(data.latitude, row.latitude),
        longitude: numToText(data.longitude, row.longitude),
        place_label:
          data.place_label !== undefined ? data.place_label : row.place_label,
      },
      { where: eq("id", 1) }
    );

    const updated = this.db.get(trip, { where: eq("id", 1) })!;
    return formatTrip(updated);
  }

  async destroy(): Promise<{ ok: boolean }> {
    // Wipe all tables — order matters for foreign keys
    this.db.raw("DELETE FROM expense_split", []);
    this.db.raw("DELETE FROM expense", []);
    this.db.raw("DELETE FROM gear_contribution", []);
    this.db.raw("DELETE FROM car_signup", []);
    this.db.raw("DELETE FROM car", []);
    this.db.raw("DELETE FROM gear_category", []);
    this.db.raw("DELETE FROM user", []);
    this.db.raw("DELETE FROM trip", []);
    return { ok: true };
  }

  // ---- Users ----

  async listUsers(): Promise<User[]> {
    return this.db.all(user).map(formatUser);
  }

  async createUser(
    data: { name: string; joining: boolean }
  ): Promise<User> {
    const name = data.name.trim();
    if (!name) throw new Error("Name required");

    const t = this.db.get(trip, { where: eq("id", 1) });
    if (!t) throw new Error("Trip not found");

    const row = this.db.insertReturning(
      user,
      { name, joining: data.joining ? 1 : 0 },
      ["id", "name", "joining", "is_organizer", "signup_completed", "can_lead_belay"]
    );
    return formatUser(row);
  }

  async deleteUser(userId: number): Promise<{ ok: boolean }> {
    this.db.delete(user, { where: eq("id", userId) });
    return { ok: true };
  }

  async completeSignup(userId: number): Promise<User> {
    const row = this.db.get(user, { where: eq("id", userId) });
    if (!row) throw new Error("User not found");

    this.db.update(user, { signup_completed: 1 }, { where: eq("id", userId) });

    const updated = this.db.get(user, { where: eq("id", userId) })!;
    return formatUser(updated);
  }

  async updateUser(
    userId: number,
    data: { name?: string; joining?: boolean; can_lead_belay?: boolean }
  ): Promise<User> {
    const row = this.db.get(user, { where: eq("id", userId) });
    if (!row) throw new Error("User not found");

    const newName =
      data.name !== undefined ? data.name.trim() : row.name;
    if (!newName) throw new Error("Name cannot be empty");
    const newJoining =
      data.joining !== undefined ? (data.joining ? 1 : 0) : row.joining;
    const newLeadBelay =
      data.can_lead_belay !== undefined
        ? (data.can_lead_belay ? 1 : 0)
        : row.can_lead_belay;

    this.db.update(
      user,
      { name: newName, joining: newJoining, can_lead_belay: newLeadBelay },
      { where: eq("id", userId) }
    );

    const updated = this.db.get(user, { where: eq("id", userId) })!;
    return formatUser(updated);
  }

  // ---- Gear Categories ----

  async listCategories(): Promise<Category[]> {
    return this.db.all(gearCategory).map(formatCategory);
  }

  async addCategory(
    data: {
      name: string;
      fields: { key: string; label: string; type: string }[];
    }
  ): Promise<Category> {
    const row = this.db.insertReturning(
      gearCategory,
      { name: data.name, fields: JSON.stringify(data.fields) },
      ["id", "name", "fields"]
    );
    return formatCategory(row);
  }

  async updateCategory(
    catId: number,
    data: {
      name?: string;
      fields?: { key: string; label: string; type: string }[];
    }
  ): Promise<Category> {
    const row = this.db.get(gearCategory, { where: eq("id", catId) });
    if (!row) throw new Error("Category not found");

    const patch: { name?: string; fields?: string } = {};
    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) throw new Error("Name cannot be empty");
      patch.name = trimmed;
    }
    if (data.fields !== undefined) {
      patch.fields = JSON.stringify(data.fields);
    }

    this.db.update(gearCategory, patch, { where: eq("id", catId) });

    const updated = this.db.get(gearCategory, { where: eq("id", catId) })!;
    return formatCategory(updated);
  }

  async deleteCategory(catId: number): Promise<{ ok: boolean }> {
    this.db.delete(gearCategory, { where: eq("id", catId) });
    return { ok: true };
  }

  // ---- Cars ----

  async listCars(): Promise<Car[]> {
    const rows = this.db.all(car);
    return rows.map((r) => this.formatCar(r));
  }

  async createCar(data: {
    driver_user_id: number;
    total_seats: number;
    notes: string | null;
  }): Promise<Car> {
    if (data.total_seats < 1) throw new Error("total_seats must be >= 1");

    const driver = this.db.get(user, { where: eq("id", data.driver_user_id) });
    if (!driver) throw new Error("Driver not found");

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
  ): Promise<Car> {
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
  ): Promise<Car> {
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

  async listGear(): Promise<Contribution[]> {
    const rows = this.db.all(gearContribution);
    return rows.map((r) => this.formatContribution(r));
  }

  async addGear(data: {
    user_id: number;
    category_id: number;
    details: Record<string, unknown>;
  }): Promise<Contribution> {
    const u = this.db.get(user, { where: eq("id", data.user_id) });
    if (!u) throw new Error("User not found");

    const row = this.db.insertReturning(
      gearContribution,
      {
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

  // ---- Expenses ----

  async listExpenses(): Promise<Expense[]> {
    const rows = this.db.all(expense);
    return rows.map((r) => this.formatExpense(r));
  }

  async createExpense(data:
    | {
        payer_user_id: number;
        amount_cents: number;
        description: string;
        split_mode: "equal";
        split_user_ids: number[];
        is_settlement?: boolean;
      }
    | {
        payer_user_id: number;
        amount_cents: number;
        description: string;
        split_mode: "custom";
        splits: { user_id: number; amount_cents: number }[];
        is_settlement?: boolean;
      }
    | {
        // Legacy format (no split_mode)
        payer_user_id: number;
        amount_cents: number;
        description: string;
        split_user_ids: number[];
      }
  ): Promise<Expense> {
    const payer = this.db.get(user, { where: eq("id", data.payer_user_id) });
    if (!payer) throw new Error("Payer not found");

    if (data.amount_cents < 1) throw new Error("Amount must be positive");
    if (!data.description.trim()) throw new Error("Description required");

    // Normalize to a list of { user_id, amount_cents | null }
    let splitRows: { user_id: number; amount_cents: number | null }[];

    if ("split_mode" in data && data.split_mode === "custom") {
      if (data.splits.length === 0) throw new Error("At least one split member required");
      const total = data.splits.reduce((s, r) => s + r.amount_cents, 0);
      if (total !== data.amount_cents) {
        throw new Error(`Split amounts (${total}) must equal the expense total (${data.amount_cents})`);
      }
      splitRows = data.splits.map((s) => ({ user_id: s.user_id, amount_cents: s.amount_cents }));
    } else {
      // Equal split (explicit or legacy)
      const ids = "split_user_ids" in data ? data.split_user_ids : [];
      if (ids.length === 0) throw new Error("At least one split member required");
      splitRows = ids.map((uid) => ({ user_id: uid, amount_cents: null }));
    }

    const now = new Date().toISOString();
    const isSettlement = "is_settlement" in data && data.is_settlement ? 1 : 0;
    const row = this.db.insertReturning(
      expense,
      {
        payer_user_id: data.payer_user_id,
        amount_cents: data.amount_cents,
        description: data.description.trim(),
        created_at: now,
        is_settlement: isSettlement,
      },
      ["id"]
    );

    for (const sr of splitRows) {
      this.db.insert(expenseSplit, {
        expense_id: row.id,
        user_id: sr.user_id,
        amount_cents: sr.amount_cents,
      });
    }

    return this.formatExpense(
      this.db.get(expense, { where: eq("id", row.id) })!
    );
  }

  async updateExpense(
    expenseId: number,
    data:
      | {
          payer_user_id: number;
          amount_cents: number;
          description: string;
          split_mode: "equal";
          split_user_ids: number[];
          is_settlement?: boolean;
        }
      | {
          payer_user_id: number;
          amount_cents: number;
          description: string;
          split_mode: "custom";
          splits: { user_id: number; amount_cents: number }[];
          is_settlement?: boolean;
        }
  ): Promise<Expense> {
    const existing = this.db.get(expense, { where: eq("id", expenseId) });
    if (!existing) throw new Error("Expense not found");

    const payer = this.db.get(user, { where: eq("id", data.payer_user_id) });
    if (!payer) throw new Error("Payer not found");

    if (data.amount_cents < 1) throw new Error("Amount must be positive");
    if (!data.description.trim()) throw new Error("Description required");

    // Normalize splits
    let splitRows: { user_id: number; amount_cents: number | null }[];

    if (data.split_mode === "custom") {
      if (data.splits.length === 0) throw new Error("At least one split member required");
      const total = data.splits.reduce((s, r) => s + r.amount_cents, 0);
      if (total !== data.amount_cents) {
        throw new Error(`Split amounts (${total}) must equal the expense total (${data.amount_cents})`);
      }
      splitRows = data.splits.map((s) => ({ user_id: s.user_id, amount_cents: s.amount_cents }));
    } else {
      if (data.split_user_ids.length === 0) throw new Error("At least one split member required");
      splitRows = data.split_user_ids.map((uid) => ({ user_id: uid, amount_cents: null }));
    }

    const isSettlement = "is_settlement" in data && data.is_settlement ? 1 : 0;

    // Update expense row
    this.db.update(
      expense,
      {
        payer_user_id: data.payer_user_id,
        amount_cents: data.amount_cents,
        description: data.description.trim(),
        is_settlement: isSettlement,
      },
      { where: eq("id", expenseId) }
    );

    // Replace splits: delete old, insert new
    this.db.raw("DELETE FROM expense_split WHERE expense_id = ?", [expenseId]);
    for (const sr of splitRows) {
      this.db.insert(expenseSplit, {
        expense_id: expenseId,
        user_id: sr.user_id,
        amount_cents: sr.amount_cents,
      });
    }

    return this.formatExpense(
      this.db.get(expense, { where: eq("id", expenseId) })!
    );
  }

  async deleteExpense(expenseId: number): Promise<{ ok: boolean }> {
    const row = this.db.get(expense, { where: eq("id", expenseId) });
    if (!row) throw new Error("Expense not found");
    this.db.raw("DELETE FROM expense_split WHERE expense_id = ?", [expenseId]);
    this.db.delete(expense, { where: eq("id", expenseId) });
    return { ok: true };
  }

  async getBalances(): Promise<Settlement[]> {
    const rows = this.db.all(expense);
    const expensesWithSplits = rows.map((r) => {
      const splits = this.db.raw<{ user_id: number; amount_cents: number | null }>(
        "SELECT user_id, amount_cents FROM expense_split WHERE expense_id = ?",
        [r.id]
      );
      return {
        payer_user_id: r.payer_user_id,
        amount_cents: r.amount_cents,
        splits: splits.map((s) => ({
          user_id: s.user_id,
          ...(s.amount_cents != null ? { amount_cents: s.amount_cents } : {}),
        })),
      };
    });

    const rawSettlements = computeSimplifiedBalances(expensesWithSplits);

    return rawSettlements.map((s) => {
      const from = this.db.get(user, { where: eq("id", s.from_user_id) });
      const to = this.db.get(user, { where: eq("id", s.to_user_id) });
      return {
        ...s,
        from_name: from?.name ?? "(unknown)",
        to_name: to?.name ?? "(unknown)",
      };
    });
  }



  // ---- Helpers ----

  private formatCar(r: {
    id: number;
    driver_user_id: number;
    total_seats: number;
    notes: string | null;
  }): Car {
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

  private formatExpense(r: {
    id: number;
    payer_user_id: number;
    amount_cents: number;
    description: string;
    created_at: string;
    is_settlement: number;
  }): Expense {
    const payer = this.db.get(user, { where: eq("id", r.payer_user_id) });
    const splits = this.db.raw<{ user_id: number; name: string; amount_cents: number | null }>(
      `SELECT u.id as user_id, u.name as name, es.amount_cents
       FROM expense_split es JOIN user u ON u.id = es.user_id
       WHERE es.expense_id = ? ORDER BY es.id`,
      [r.id]
    );
    return {
      id: r.id,
      payer_user_id: r.payer_user_id,
      payer_name: payer?.name ?? "(unknown)",
      amount_cents: r.amount_cents,
      description: r.description,
      created_at: r.created_at,
      is_settlement: Boolean(r.is_settlement),
      splits: splits.map((s) => ({
        user_id: s.user_id,
        name: s.name,
        amount_cents: s.amount_cents ?? undefined,
      })),
    };
  }

  private formatContribution(r: {
    id: number;
    user_id: number;
    category_id: number;
    details: string;
  }): Contribution {
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

function formatTrip(r: {
  id: number;
  location: string;
  start_date: string | null;
  end_date: string | null;
  accommodation_type: string | null;
  accommodation_details: string | null;
  notes: string | null;
  latitude?: string | null;
  longitude?: string | null;
  place_label?: string | null;
}): Trip {
  return {
    location: r.location,
    start_date: r.start_date,
    end_date: r.end_date,
    accommodation_type: r.accommodation_type,
    accommodation_details: r.accommodation_details,
    notes: r.notes,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
    place_label: r.place_label ?? null,
  };
}

function formatUser(r: {
  id: number;
  name: string;
  joining: number;
  is_organizer: number;
  signup_completed: number;
  can_lead_belay?: number;
}): User {
  return {
    id: r.id,
    name: r.name,
    joining: Boolean(r.joining),
    is_organizer: Boolean(r.is_organizer),
    signup_completed: Boolean(r.signup_completed),
    can_lead_belay: Boolean(r.can_lead_belay),
  };
}

function formatCategory(r: {
  id: number;
  name: string;
  fields: string;
}): Category {
  return {
    id: r.id,
    name: r.name,
    fields: typeof r.fields === "string" ? JSON.parse(r.fields) : r.fields,
  };
}
