ALTER TABLE `user` ADD COLUMN `claimed` INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `user` SET `claimed` = 1;
