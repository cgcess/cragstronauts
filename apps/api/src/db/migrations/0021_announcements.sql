CREATE TABLE `announcement` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `parent_id` INTEGER REFERENCES `announcement`(`id`) ON DELETE CASCADE,
  `user_id` INTEGER REFERENCES `user`(`id`) ON DELETE SET NULL,
  `author_name` TEXT NOT NULL,
  `author_avatar_url` TEXT,
  `body` TEXT NOT NULL,
  `created_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE `announcement_reaction` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `announcement_id` INTEGER NOT NULL REFERENCES `announcement`(`id`) ON DELETE CASCADE,
  `user_id` INTEGER NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `emoji` TEXT NOT NULL,
  `created_at` TEXT NOT NULL,
  UNIQUE(`announcement_id`, `user_id`, `emoji`)
);
