import { describe, it, expect } from "vitest";
import {
  CarSchema,
  CreateCarBodySchema,
  CarSignupBodySchema,
  DogSchema,
  CarDogSchema,
  CreateDogBodySchema,
  AssignDogBodySchema,
} from "./car";

describe("CarSchema", () => {
  const base = {
    id: 1,
    driver_user_id: 2,
    driver_name: "Alex",
    total_seats: 4,
    reserved_seats: 1,
    notes: null,
    passengers: [],
    dogs: [],
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

describe("CarSchema dogs", () => {
  const base = {
    id: 1,
    driver_user_id: 2,
    driver_name: "Alex",
    total_seats: 4,
    reserved_seats: 0,
    notes: null,
    passengers: [],
    dogs: [{ dog_id: 9, name: "Rex", owner_user_id: 2, owner_name: "Alex" }],
  };

  it("accepts a car carrying dogs", () => {
    expect(CarSchema.safeParse(base).success).toBe(true);
  });

  it("requires dogs", () => {
    const { dogs, ...withoutDogs } = base;
    void dogs;
    expect(CarSchema.safeParse(withoutDogs).success).toBe(false);
  });
});

describe("DogSchema", () => {
  const base = {
    id: 1,
    name: "Rex",
    owner_user_id: 2,
    owner_name: "Alex",
    car_id: null,
  };

  it("accepts a dog with no car", () => {
    expect(DogSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a dog assigned to a car", () => {
    expect(DogSchema.safeParse({ ...base, car_id: 7 }).success).toBe(true);
  });

  it("requires owner_name", () => {
    const { owner_name, ...rest } = base;
    void owner_name;
    expect(DogSchema.safeParse(rest).success).toBe(false);
  });
});

describe("CarDogSchema", () => {
  it("accepts a per-car dog projection", () => {
    const result = CarDogSchema.safeParse({
      dog_id: 9,
      name: "Rex",
      owner_user_id: 2,
      owner_name: "Alex",
    });
    expect(result.success).toBe(true);
  });
});

describe("CreateDogBodySchema", () => {
  it("accepts a valid body", () => {
    expect(
      CreateDogBodySchema.safeParse({ owner_user_id: 2, name: "Rex" }).success
    ).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(
      CreateDogBodySchema.safeParse({ owner_user_id: 2, name: "" }).success
    ).toBe(false);
  });
});

describe("AssignDogBodySchema", () => {
  it("accepts a dog_id", () => {
    expect(AssignDogBodySchema.safeParse({ dog_id: 9 }).success).toBe(true);
  });

  it("requires a dog_id", () => {
    expect(AssignDogBodySchema.safeParse({}).success).toBe(false);
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
