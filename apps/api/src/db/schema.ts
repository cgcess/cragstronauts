import { table, column, ref } from "do-orm";

export const trip = table("trip", {
  id: column.integer().notNull().primaryKey(),
  location: column.text().notNull(),
  start_date: column.text(),
  end_date: column.text(),
  accommodation_type: column.text(),
  accommodation_details: column.text(),
  notes: column.text(),
});

export const user = table("user", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  trip_id: column.integer().notNull().references(ref(trip, "id")),
  name: column.text().notNull(),
  joining: column.integer().notNull().default(1),
  is_organizer: column.integer().notNull().default(0),
});

export const gearCategory = table("gear_category", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  trip_id: column.integer().notNull().references(ref(trip, "id")),
  name: column.text().notNull(),
  fields: column.text().notNull(),
});

export const car = table("car", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  trip_id: column.integer().notNull().references(ref(trip, "id")),
  driver_user_id: column.integer().notNull().references(ref(user, "id")),
  total_seats: column.integer().notNull(),
  notes: column.text(),
});

export const carSignup = table("car_signup", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  car_id: column.integer().notNull().references(ref(car, "id")),
  user_id: column.integer().notNull().references(ref(user, "id")),
});

export const gearContribution = table("gear_contribution", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  trip_id: column.integer().notNull().references(ref(trip, "id")),
  user_id: column.integer().notNull().references(ref(user, "id")),
  category_id: column.integer().notNull().references(ref(gearCategory, "id")),
  details: column.text().notNull(),
});
