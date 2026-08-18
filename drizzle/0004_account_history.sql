CREATE TABLE IF NOT EXISTS `measurement_history` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `kind` text NOT NULL,
  `title` text NOT NULL,
  `summary` text NOT NULL DEFAULT '',
  `input_json` text NOT NULL,
  `result_json` text NOT NULL,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS `idx_measurement_history_user_created`
ON `measurement_history` (`user_id`, `created_at`);
PRAGMA optimize;
