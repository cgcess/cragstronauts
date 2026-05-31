CREATE TABLE `settlement` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `from_user_id` INTEGER NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `to_user_id` INTEGER NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `amount_cents` INTEGER NOT NULL,
  `created_at` TEXT NOT NULL DEFAULT (datetime('now'))
);
