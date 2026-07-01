CREATE TABLE `trip_member` (
  `account_id` TEXT NOT NULL,
  `trip_id` TEXT NOT NULL,
  PRIMARY KEY (`account_id`, `trip_id`)
);