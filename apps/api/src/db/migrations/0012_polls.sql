CREATE TABLE `poll` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `question` TEXT NOT NULL,
  `description` TEXT,
  `emoji` TEXT,
  `position` INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `poll_option` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `poll_id` INTEGER NOT NULL REFERENCES `poll`(`id`) ON DELETE CASCADE,
  `label` TEXT NOT NULL,
  `emoji` TEXT,
  `position` INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `poll_answer` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `poll_id` INTEGER NOT NULL REFERENCES `poll`(`id`) ON DELETE CASCADE,
  `option_id` INTEGER NOT NULL REFERENCES `poll_option`(`id`) ON DELETE CASCADE,
  `user_id` INTEGER NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `poll` (`question`, `emoji`, `position`) VALUES ('Can you lead belay?', '🛡', 0);
--> statement-breakpoint
INSERT INTO `poll_option` (`poll_id`, `label`, `position`)
  SELECT `id`, 'Yes', 0 FROM `poll` WHERE `question` = 'Can you lead belay?';
--> statement-breakpoint
INSERT INTO `poll_option` (`poll_id`, `label`, `position`)
  SELECT `id`, 'No', 1 FROM `poll` WHERE `question` = 'Can you lead belay?';
--> statement-breakpoint
INSERT INTO `poll_answer` (`poll_id`, `option_id`, `user_id`)
  SELECT p.id, o.id, u.id
  FROM `user` u
  JOIN `poll` p ON p.question = 'Can you lead belay?'
  JOIN `poll_option` o ON o.poll_id = p.id AND o.label = 'Yes'
  WHERE u.can_lead_belay = 1;
