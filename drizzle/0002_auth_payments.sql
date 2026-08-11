ALTER TABLE `users` ADD COLUMN `password_hash` text NOT NULL DEFAULT '';

CREATE TABLE `sessions` (
  `token_hash` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `expires_at` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);

INSERT INTO `credit_packages` (`id`,`name`,`credits`,`price_fen`,`active`,`sort_order`)
VALUES ('light','轻量体验',10,990,1,1),
       ('deep','深度探索',50,3900,1,2),
       ('long','长期使用',120,7900,1,3)
ON CONFLICT DO NOTHING;
