-- Dogs are first-class trip-level entities owned by a user.
-- A dog rides in a car via car_dog (parallel to car_signup), occupying a
-- seat like a passenger, but is never a climber.

CREATE TABLE `dog` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `owner_user_id` INTEGER NOT NULL REFERENCES `user`(`id`) ON DELETE RESTRICT,
  `name` TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE `car_dog` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `car_id` INTEGER NOT NULL REFERENCES `car`(`id`) ON DELETE CASCADE,
  `dog_id` INTEGER NOT NULL REFERENCES `dog`(`id`) ON DELETE CASCADE
);
