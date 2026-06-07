import { table, column } from "do-orm";

export const tripIndex = table("trip_index", {
  id: column.text().notNull().primaryKey(),
  name: column.text().notNull(),
  location: column.text().notNull(),
  start_date: column.text(),
  end_date: column.text(),
});
