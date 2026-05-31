CREATE TABLE `expense` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `payer_user_id` INTEGER NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `amount_cents` INTEGER NOT NULL,
  `description` TEXT NOT NULL,
  `created_at` TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `expense_split` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `expense_id` INTEGER NOT NULL REFERENCES `expense`(`id`) ON DELETE CASCADE,
  `user_id` INTEGER NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  UNIQUE(`expense_id`, `user_id`)
);
