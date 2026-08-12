ALTER TABLE `users` ADD COLUMN `email_verified_at` text;

-- Existing accounts that already received the signup gift keep it without re-verifying.
UPDATE `users`
SET `email_verified_at` = CURRENT_TIMESTAMP
WHERE `id` IN (SELECT `user_id` FROM `credit_ledger` WHERE `kind` = 'signup_gift');

CREATE TABLE `email_verifications` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `code_hash` text NOT NULL,
  `attempts` integer DEFAULT 0 NOT NULL,
  `expires_at` text NOT NULL,
  `completed_at` text,
  `resend_after` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `email_verifications_user_idx` ON `email_verifications` (`user_id`);
CREATE INDEX `email_verifications_expiry_idx` ON `email_verifications` (`expires_at`);

CREATE TABLE `registration_events` (
  `id` text PRIMARY KEY NOT NULL,
  `ip_hash` text NOT NULL,
  `email` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `registration_events_ip_idx` ON `registration_events` (`ip_hash`, `created_at`);
