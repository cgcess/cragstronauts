import { table, column } from "do-orm";

// Per-account index of owned/joined trips, meta denormalized for a one-read list.
export const accountTripIndex = table("account_trip_index", {
  trip_id: column.text().notNull().primaryKey(),
  role: column.text().notNull(),
  name: column.text().notNull(),
  location: column.text().notNull(),
  start_date: column.text(),
  end_date: column.text(),
});

// A Web Push subscription for one of the account's devices. `endpoint` is unique
// so re-subscribing the same device upserts rather than duplicating. Account-
// scoped (the DO *is* the account), so one opt-in per device covers every trip
// that account drives on, and a send fans out to all the account's devices.
export const pushSubscription = table("push_subscription", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  endpoint: column.text().notNull(),
  p256dh: column.text().notNull(),
  auth: column.text().notNull(),
  created_at: column.text().notNull(),
});
