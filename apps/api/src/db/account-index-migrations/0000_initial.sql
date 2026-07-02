CREATE TABLE `account_trip_index` (
  `trip_id` TEXT PRIMARY KEY,
  `role` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `location` TEXT NOT NULL,
  `start_date` TEXT,
  `end_date` TEXT
);
