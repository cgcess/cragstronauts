-- Recreate expense and expense_split tables to replace
-- ON DELETE CASCADE with ON DELETE RESTRICT on user FKs.
-- This prevents silent data loss when a user is deleted.

-- 1. Disable FK checks during the table swap.
PRAGMA foreign_keys = OFF;
--> statement-breakpoint

-- 2. Recreate expense with RESTRICT on payer_user_id.
CREATE TABLE `expense_new` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `payer_user_id` INTEGER NOT NULL REFERENCES `user`(`id`) ON DELETE RESTRICT,
  `amount_cents` INTEGER NOT NULL,
  `description` TEXT NOT NULL,
  `created_at` TEXT NOT NULL DEFAULT (datetime('now')),
  `is_settlement` INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
INSERT INTO `expense_new` SELECT `id`, `payer_user_id`, `amount_cents`, `description`, `created_at`, `is_settlement` FROM `expense`;
--> statement-breakpoint
DROP TABLE `expense`;
--> statement-breakpoint
ALTER TABLE `expense_new` RENAME TO `expense`;
--> statement-breakpoint

-- 3. Recreate expense_split: RESTRICT on user_id, keep CASCADE on expense_id.
CREATE TABLE `expense_split_new` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `expense_id` INTEGER NOT NULL REFERENCES `expense`(`id`) ON DELETE CASCADE,
  `user_id` INTEGER NOT NULL REFERENCES `user`(`id`) ON DELETE RESTRICT,
  `amount_cents` INTEGER,
  UNIQUE(`expense_id`, `user_id`)
);
--> statement-breakpoint
INSERT INTO `expense_split_new` SELECT `id`, `expense_id`, `user_id`, `amount_cents` FROM `expense_split`;
--> statement-breakpoint
DROP TABLE `expense_split`;
--> statement-breakpoint
ALTER TABLE `expense_split_new` RENAME TO `expense_split`;
--> statement-breakpoint

-- 4. Re-enable FK checks.
PRAGMA foreign_keys = ON;
