ALTER TABLE `user` ADD COLUMN `signup_completed` INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `user` SET `signup_completed` = 1;
