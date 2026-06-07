CREATE TABLE `trip_new` (
  `id` INTEGER PRIMARY KEY,
  `name` TEXT NOT NULL,
  `location` TEXT NOT NULL,
  `start_date` TEXT,
  `end_date` TEXT,
  `accommodation_type` TEXT,
  `accommodation_details` TEXT,
  `notes` TEXT,
  `latitude` TEXT,
  `longitude` TEXT,
  `place_label` TEXT,
  `welcome_message` TEXT,
  `signature` TEXT
);
--> statement-breakpoint
INSERT INTO `trip_new` (
  id, name, location, start_date, end_date,
  accommodation_type, accommodation_details, notes,
  latitude, longitude, place_label, welcome_message, signature
)
SELECT
  id, location, location, start_date, end_date,
  accommodation_type, accommodation_details, notes,
  latitude, longitude, place_label, welcome_message, signature
FROM `trip`;
--> statement-breakpoint
DROP TABLE `trip`;
--> statement-breakpoint
ALTER TABLE `trip_new` RENAME TO `trip`;
