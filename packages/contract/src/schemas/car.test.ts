import { describe, it, expect } from "vitest";
import { CarSchema, CreateCarBodySchema, CarSignupBodySchema } from "./car";

describe("CarSchema", () => {
  const base = {
    id: 1,
    driver_user_id: 2,
    driver_name: "Alex",
    total_seats: 4,
    reserved_seats: 1,
    notes: null,
    passengers: [],
  };

  it("accepts a valid car with reserved_seats", () => {
    const result = CarSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("requires reserved_seats", () => {
    const { reserved_seats, ...withoutReserved } = base;
    void reserved_seats;
    const result = CarSchema.safeParse(withoutReserved);
    expect(result.success).toBe(false);
  });
});

describe("CreateCarBodySchema", () => {
  it("accepts reserved_seats", () => {
    const result = CreateCarBodySchema.safeParse({
      driver_user_id: 1,
      total_seats: 4,
      reserved_seats: 2,
      notes: null,
    });
    expect(result.success).toBe(true);
  });

  it("treats reserved_seats as optional", () => {
    const result = CreateCarBodySchema.safeParse({
      driver_user_id: 1,
      total_seats: 4,
      notes: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative reserved_seats", () => {
    const result = CreateCarBodySchema.safeParse({
      driver_user_id: 1,
      total_seats: 4,
      reserved_seats: -1,
      notes: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("CarSignupBodySchema", () => {
  it("accepts from_reserved", () => {
    const result = CarSignupBodySchema.safeParse({
      user_id: 1,
      from_reserved: true,
    });
    expect(result.success).toBe(true);
  });

  it("treats from_reserved as optional", () => {
    const result = CarSignupBodySchema.safeParse({ user_id: 1 });
    expect(result.success).toBe(true);
  });
});
