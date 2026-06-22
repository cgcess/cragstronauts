import { table, column, ref } from "do-orm";

export const trip = table("trip", {
  id: column.integer().notNull().primaryKey(),
  name: column.text().notNull(),
  location: column.text().notNull(),
  start_date: column.text(),
  end_date: column.text(),
  accommodation_type: column.text(),
  accommodation_details: column.text(),
  notes: column.text(),
  latitude: column.text(),
  longitude: column.text(),
  place_label: column.text(),
  welcome_message: column.text(),
  signature: column.text(),
  links: column.text(),
});

export const user = table("user", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  name: column.text().notNull(),
  joining: column.integer().notNull().default(1),
  is_organizer: column.integer().notNull().default(0),
  signup_completed: column.integer().notNull().default(0),
  claimed: column.integer().notNull().default(0),
  // Google account `sub` this person is bound to, or NULL when unlinked (the
  // cooperative-identity default). Set when a signed-in user claims this slot.
  account_id: column.text(),
});

export const poll = table("poll", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  question: column.text().notNull(),
  description: column.text(),
  emoji: column.text(),
  position: column.integer().notNull().default(0),
});

export const pollOption = table("poll_option", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  poll_id: column.integer().notNull().references(ref(poll, "id")),
  label: column.text().notNull(),
  emoji: column.text(),
  position: column.integer().notNull().default(0),
});

export const pollAnswer = table("poll_answer", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  poll_id: column.integer().notNull().references(ref(poll, "id")),
  option_id: column.integer().notNull().references(ref(pollOption, "id")),
  user_id: column.integer().notNull().references(ref(user, "id")),
});

export const gearCategory = table("gear_category", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  name: column.text().notNull(),
  fields: column.text().notNull(),
  summary_mode: column.text().notNull().default("people"),
  // Canonical catalog slug (GEAR_CATALOG) when this category came from a preset,
  // or NULL for free-form custom gear. Lets a profile's kit match the category.
  catalog_key: column.text(),
});

export const car = table("car", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  driver_user_id: column.integer().notNull().references(ref(user, "id")),
  total_seats: column.integer().notNull(),
  reserved_seats: column.integer().notNull().default(0),
  notes: column.text(),
});

export const carSignup = table("car_signup", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  car_id: column.integer().notNull().references(ref(car, "id")),
  user_id: column.integer().notNull().references(ref(user, "id")),
});

export const dog = table("dog", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  owner_user_id: column.integer().notNull().references(ref(user, "id")),
  name: column.text().notNull(),
});

export const carDog = table("car_dog", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  car_id: column.integer().notNull().references(ref(car, "id")),
  dog_id: column.integer().notNull().references(ref(dog, "id")),
});

export const gearContribution = table("gear_contribution", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  user_id: column.integer().notNull().references(ref(user, "id")),
  category_id: column.integer().notNull().references(ref(gearCategory, "id")),
  details: column.text().notNull(),
});

export const expense = table("expense", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  payer_user_id: column.integer().notNull().references(ref(user, "id")),
  amount_cents: column.integer().notNull(),
  description: column.text().notNull(),
  created_at: column.text().notNull(),
  is_settlement: column.integer().notNull().default(0),
});

export const expenseSplit = table("expense_split", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  expense_id: column.integer().notNull().references(ref(expense, "id")),
  user_id: column.integer().notNull().references(ref(user, "id")),
  amount_cents: column.integer(),
});

export const feedback = table("feedback", {
  id: column.integer().notNull().primaryKey().autoIncrement(),
  // Null when anonymous, or if the author later leaves the trip.
  user_id: column.integer().references(ref(user, "id")),
  body: column.text().notNull(),
  anonymous: column.integer().notNull().default(0),
  created_at: column.text().notNull(),
});

