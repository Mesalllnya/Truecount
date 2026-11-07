-- USB Token Challenges (Sprint 4 - MFA)
-- Menyimpan challenge sementara untuk register & authenticate flow

CREATE TABLE IF NOT EXISTS `usb_challenges` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `challenge` VARBINARY(32) NOT NULL COMMENT 'Random 32 bytes challenge',
  `challenge_type` ENUM('register', 'authenticate') NOT NULL DEFAULT 'register',
  `status` ENUM('pending', 'used', 'expired') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL 5 MINUTE),
  `used_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_status` (`user_id`, `status`),
  KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Challenge sementara untuk USB token register/authenticate';