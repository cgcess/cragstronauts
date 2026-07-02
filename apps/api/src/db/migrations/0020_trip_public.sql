ALTER TABLE `trip` ADD COLUMN `public` INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `trip` SET `public` = 1;
