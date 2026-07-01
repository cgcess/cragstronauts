import { table, column } from "do-orm";

export const tripIndex = table("trip_index", {
  id: column.text().notNull().primaryKey(),
  name: column.text().notNull(),
  location: column.text().notNull(),
  start_date: column.text(),
  end_date: column.text(),
});

export const tripMember = table("trip_member", {
  account_id: column.text().notNull(),
  trip_id: column.text().notNull(),
});
