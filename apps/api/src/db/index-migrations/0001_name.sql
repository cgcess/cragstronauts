CREATE TABLE `trip_index_new` (
  `id` TEXT PRIMARY KEY,
  `name` TEXT NOT NULL,
  `location` TEXT NOT NULL,
  `start_date` TEXT,
  `end_date` TEXT
);
--> statement-breakpoint
INSERT INTO `trip_index_new` (id, name, location, start_date, end_date)
SELECT id, location, location, start_date, end_date FROM `trip_index`;
--> statement-breakpoint
DROP TABLE `trip_index`;
--> statement-breakpoint
ALTER TABLE `trip_index_new` RENAME TO `trip_index`;
