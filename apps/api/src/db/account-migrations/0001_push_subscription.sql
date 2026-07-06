CREATE TABLE `push_subscription` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `endpoint` TEXT NOT NULL UNIQUE,
  `p256dh` TEXT NOT NULL,
  `auth` TEXT NOT NULL,
  `created_at` TEXT NOT NULL
);
