CREATE TABLE `feedback` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Null when submitted anonymously (or if the author later leaves the trip).
  `user_id` INTEGER REFERENCES `user`(`id`) ON DELETE SET NULL,
  `body` TEXT NOT NULL,
  `anonymous` INTEGER NOT NULL DEFAULT 0,
  `created_at` TEXT NOT NULL DEFAULT (datetime('now'))
);
