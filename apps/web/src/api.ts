// Typed fetch wrappers around the backend.
// Return types are inferred from the contract Zod schemas.

import type { z } from "zod";
import type {
  TripSchema,
  CreateTripResponseSchema,
  TripIndexEntrySchema,
  UserSchema,
  CarSchema,
  GearCategorySchema,
  GearContributionSchema,
} from "@cragstronauts/contract";

type Trip = z.infer<typeof TripSchema>;
type CreateTripResponse = z.infer<typeof CreateTripResponseSchema>;
type TripIndexEntry = z.infer<typeof TripIndexEntrySchema>;
type User = z.infer<typeof UserSchema>;
type Car = z.infer<typeof CarSchema>;
type Category = z.infer<typeof GearCategorySchema>;
type Contribution = z.infer<typeof GearContributionSchema>;
type Ok = { ok: boolean };

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = { method, headers: {} };
  if (body !== undefined) {
    (opts.headers as Record<string, string>)["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(path, opts);
  if (!r.ok) {
    let detail = r.statusText;
    try {
      const j = (await r.json()) as { detail?: string };
      detail = j.detail || JSON.stringify(j);
    } catch {}
    throw new Error(`${r.status} ${detail}`);
  }
  if (r.status === 204) return null as T;
  return r.json() as Promise<T>;
}

export const api = {
  // Trips
  listTrips: () => req<TripIndexEntry[]>("GET", "/api/trips"),
  createTrip: (data: {
    location: string;
    start_date: string | null;
    end_date: string | null;
    accommodation_type: string | null;
    accommodation_details: string | null;
    notes: string | null;
    latitude?: number | null;
    longitude?: number | null;
    place_label?: string | null;
    organizer_name: string;
    gear_categories: { name: string; fields: { key: string; label: string; type: string }[] }[];
  }) => req<CreateTripResponse>("POST", "/api/trips", data),
  getTrip: (tripId: string) => req<Trip>("GET", `/api/trips/${tripId}`),
  updateTrip: (tripId: string, data: Record<string, unknown>) =>
    req<Trip>("PATCH", `/api/trips/${tripId}`, data),
  deleteTrip: (tripId: string) => req<Ok>("DELETE", `/api/trips/${tripId}`),

  // Users (within a trip)
  listUsers: (tripId: string) => req<User[]>("GET", `/api/trips/${tripId}/users`),
  createUser: (tripId: string, name: string) =>
    req<User>("POST", `/api/trips/${tripId}/users`, { name, joining: true }),
  updateUser: (tripId: string, id: number, data: { name?: string; joining?: boolean }) =>
    req<User>("PATCH", `/api/trips/${tripId}/users/${id}`, data),
  deleteUser: (tripId: string, id: number) =>
    req<Ok>("DELETE", `/api/trips/${tripId}/users/${id}`),
  completeSignup: (tripId: string, id: number) =>
    req<User>("POST", `/api/trips/${tripId}/users/${id}/complete-signup`),

  // Gear categories
  listCategories: (tripId: string) =>
    req<Category[]>("GET", `/api/trips/${tripId}/gear-categories`),
  addCategory: (tripId: string, data: { name: string; fields: { key: string; label: string; type: string }[] }) =>
    req<Category>("POST", `/api/trips/${tripId}/gear-categories`, data),
  updateCategory: (
    tripId: string,
    id: number,
    data: { name?: string; fields?: { key: string; label: string; type: string }[] }
  ) => req<Category>("PATCH", `/api/trips/${tripId}/gear-categories/${id}`, data),
  deleteCategory: (tripId: string, id: number) =>
    req<Ok>("DELETE", `/api/trips/${tripId}/gear-categories/${id}`),

  // Cars
  listCars: (tripId: string) => req<Car[]>("GET", `/api/trips/${tripId}/cars`),
  createCar: (tripId: string, data: { driver_user_id: number; total_seats: number; notes: string | null }) =>
    req<Car>("POST", `/api/trips/${tripId}/cars`, data),
  deleteCar: (tripId: string, id: number) =>
    req<Ok>("DELETE", `/api/trips/${tripId}/cars/${id}`),
  carSignup: (tripId: string, carId: number, userId: number) =>
    req<Car>("POST", `/api/trips/${tripId}/cars/${carId}/signup`, { user_id: userId }),
  carSignoff: (tripId: string, carId: number, userId: number) =>
    req<Car>("DELETE", `/api/trips/${tripId}/cars/${carId}/signup/${userId}`),

  // Gear contributions
  listGear: (tripId: string) => req<Contribution[]>("GET", `/api/trips/${tripId}/gear`),
  addGear: (tripId: string, data: { user_id: number; category_id: number; details: Record<string, unknown> }) =>
    req<Contribution>("POST", `/api/trips/${tripId}/gear`, data),
  deleteGear: (tripId: string, id: number) =>
    req<Ok>("DELETE", `/api/trips/${tripId}/gear/${id}`),
};
