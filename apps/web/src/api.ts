// Typed fetch wrappers around the backend.
// Return types are inferred from the contract Zod schemas.

import type { z } from "zod";
import type {
  TripSchema,
  TripLinkSchema,
  CreateTripResponseSchema,
  TripIndexEntrySchema,
  UserSchema,
  CarSchema,
  GearCategorySchema,
  GearContributionSchema,
  PollSchema,
  PollAnswerSchema,
  ExpenseSchema,
  SettlementSchema,
  FeedbackSchema,
} from "@cragstronauts/contract";

type Trip = z.infer<typeof TripSchema>;
export type TripLink = z.infer<typeof TripLinkSchema>;
type CreateTripResponse = z.infer<typeof CreateTripResponseSchema>;
type TripIndexEntry = z.infer<typeof TripIndexEntrySchema>;
type User = z.infer<typeof UserSchema>;
type Car = z.infer<typeof CarSchema>;
type Category = z.infer<typeof GearCategorySchema>;
type Contribution = z.infer<typeof GearContributionSchema>;
type Poll = z.infer<typeof PollSchema>;
type PollAnswer = z.infer<typeof PollAnswerSchema>;
type PollInput = {
  question: string;
  description?: string | null;
  emoji?: string | null;
  options: { id?: number; label: string; emoji?: string | null }[];
};
type Expense = z.infer<typeof ExpenseSchema>;
type Settlement = z.infer<typeof SettlementSchema>;
type Feedback = z.infer<typeof FeedbackSchema>;
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
    // 4xx are user-facing domain errors with a meaningful detail message, so
    // show it as-is. 5xx are unexpected — keep the status code to aid debugging.
    throw new Error(r.status >= 500 ? `${r.status} ${detail}` : detail);
  }
  if (r.status === 204) return null as T;
  return r.json() as Promise<T>;
}

export const api = {
  // Trips
  listTrips: () => req<TripIndexEntry[]>("GET", "/api/trips"),
  createTrip: (data: {
    name: string;
    location: string;
    start_date: string | null;
    end_date: string | null;
    accommodation_type: string | null;
    accommodation_details: string | null;
    notes: string | null;
    latitude?: number | null;
    longitude?: number | null;
    place_label?: string | null;
    welcome_message: string;
    signature: string;
    links?: { name: string; url: string }[];
    organizer_name: string;
    gear_categories: { name: string; fields: { key: string; label: string; type: string }[] }[];
    polls?: { question: string; description?: string | null; emoji?: string | null; options: { label: string; emoji?: string | null }[] }[];
  }) => req<CreateTripResponse>("POST", "/api/trips", data),
  getTrip: (tripId: string) => req<Trip>("GET", `/api/trips/${tripId}`),
  updateTrip: (tripId: string, data: Record<string, unknown>) =>
    req<Trip>("PATCH", `/api/trips/${tripId}`, data),
  deleteTrip: (tripId: string) => req<Ok>("DELETE", `/api/trips/${tripId}`),

  // Users (within a trip)
  listUsers: (tripId: string) => req<User[]>("GET", `/api/trips/${tripId}/users`),
  createUser: (tripId: string, name: string) =>
    req<User>("POST", `/api/trips/${tripId}/users`, { name, joining: true }),
  updateUser: (
    tripId: string,
    id: number,
    data: { name?: string; joining?: boolean }
  ) => req<User>("PATCH", `/api/trips/${tripId}/users/${id}`, data),
  deleteUser: (tripId: string, id: number) =>
    req<Ok>("DELETE", `/api/trips/${tripId}/users/${id}`),
  completeSignup: (tripId: string, id: number) =>
    req<User>("POST", `/api/trips/${tripId}/users/${id}/complete-signup`),
  makeOrganizer: (tripId: string, id: number) =>
    req<User>("POST", `/api/trips/${tripId}/users/${id}/make-organizer`),

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
  createCar: (tripId: string, data: { driver_user_id: number; total_seats: number; reserved_seats?: number; notes: string | null }) =>
    req<Car>("POST", `/api/trips/${tripId}/cars`, data),
  deleteCar: (tripId: string, id: number) =>
    req<Ok>("DELETE", `/api/trips/${tripId}/cars/${id}`),
  carSignup: (tripId: string, carId: number, userId: number, fromReserved?: boolean) =>
    req<Car>("POST", `/api/trips/${tripId}/cars/${carId}/signup`, { user_id: userId, from_reserved: fromReserved }),
  carSignoff: (tripId: string, carId: number, userId: number) =>
    req<Car>("DELETE", `/api/trips/${tripId}/cars/${carId}/signup/${userId}`),

  // Gear contributions
  listGear: (tripId: string) => req<Contribution[]>("GET", `/api/trips/${tripId}/gear`),
  addGear: (tripId: string, data: { user_id: number; category_id: number; details: Record<string, unknown> }) =>
    req<Contribution>("POST", `/api/trips/${tripId}/gear`, data),
  deleteGear: (tripId: string, id: number) =>
    req<Ok>("DELETE", `/api/trips/${tripId}/gear/${id}`),

  // Polls
  listPolls: (tripId: string) => req<Poll[]>("GET", `/api/trips/${tripId}/polls`),
  addPoll: (tripId: string, data: PollInput) =>
    req<Poll>("POST", `/api/trips/${tripId}/polls`, data),
  updatePoll: (tripId: string, id: number, data: Partial<PollInput>) =>
    req<Poll>("PATCH", `/api/trips/${tripId}/polls/${id}`, data),
  deletePoll: (tripId: string, id: number) =>
    req<Ok>("DELETE", `/api/trips/${tripId}/polls/${id}`),
  listPollAnswers: (tripId: string) =>
    req<PollAnswer[]>("GET", `/api/trips/${tripId}/poll-answers`),
  setPollAnswer: (
    tripId: string,
    data: { user_id: number; poll_id: number; option_ids: number[] }
  ) => req<PollAnswer[]>("POST", `/api/trips/${tripId}/poll-answers`, data),

  // Expenses
  listExpenses: (tripId: string) =>
    req<Expense[]>("GET", `/api/trips/${tripId}/expenses`),
  createExpense: (
    tripId: string,
    data:
      | { payer_user_id: number; amount_cents: number; description: string; split_mode: "equal"; split_user_ids: number[]; is_settlement?: boolean }
      | { payer_user_id: number; amount_cents: number; description: string; split_mode: "custom"; splits: { user_id: number; amount_cents: number }[]; is_settlement?: boolean }
  ) => req<Expense>("POST", `/api/trips/${tripId}/expenses`, data),
  updateExpense: (
    tripId: string,
    id: number,
    data:
      | { payer_user_id: number; amount_cents: number; description: string; split_mode: "equal"; split_user_ids: number[]; is_settlement?: boolean }
      | { payer_user_id: number; amount_cents: number; description: string; split_mode: "custom"; splits: { user_id: number; amount_cents: number }[]; is_settlement?: boolean }
  ) => req<Expense>("PATCH", `/api/trips/${tripId}/expenses/${id}`, data),
  deleteExpense: (tripId: string, id: number) =>
    req<Ok>("DELETE", `/api/trips/${tripId}/expenses/${id}`),
  getBalances: (tripId: string) =>
    req<Settlement[]>("GET", `/api/trips/${tripId}/balances`),

  // Feedback
  createFeedback: (
    tripId: string,
    data: { user_id: number; body: string; anonymous?: boolean }
  ) => req<Feedback>("POST", `/api/trips/${tripId}/feedback`, data),
  // Organizer-only: pass the requesting user's id so the API can verify.
  listFeedback: (tripId: string, userId: number) =>
    req<Feedback[]>(
      "GET",
      `/api/trips/${tripId}/feedback?user_id=${userId}`
    ),

};
