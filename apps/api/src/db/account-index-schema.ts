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
