CREATE TABLE `trip` (
  `id` INTEGER PRIMARY KEY,
  `location` TEXT NOT NULL,
  `start_date` TEXT,
  `end_date` TEXT,
  `accommodation_type` TEXT,
  `accommodation_details` TEXT,
  `notes` TEXT
);
--> statement-breakpoint
CREATE TABLE `user` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `name` TEXT NOT NULL,
  `joining` INTEGER NOT NULL DEFAULT 1,
  `is_organizer` INTEGER NOT NULL DEFAULT 0,
  `signup_completed` INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `gear_category` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `name` TEXT NOT NULL,
  `fields` TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE `car` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `driver_user_id` INTEGER NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `total_seats` INTEGER NOT NULL,
  `notes` TEXT
);
--> statement-breakpoint
CREATE TABLE `car_signup` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `car_id` INTEGER NOT NULL REFERENCES `car`(`id`) ON DELETE CASCADE,
  `user_id` INTEGER NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  UNIQUE(`car_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `gear_contribution` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `user_id` INTEGER NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `category_id` INTEGER NOT NULL REFERENCES `gear_category`(`id`) ON DELETE CASCADE,
  `details` TEXT NOT NULL
);
