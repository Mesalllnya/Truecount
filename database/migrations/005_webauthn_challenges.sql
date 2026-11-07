-- =============================================================
-- TrueCount - WebAuthn Challenges Table (Sprint 4)
-- Migration: 005_webauthn_challenges.sql
-- =============================================================

USE `truecount_db`;

-- -------------------------------------------------------------
-- webauthn_challenges - Challenge storage untuk WebAuthn auth
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `webauthn_challenges` (
    `id`              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `user_id`         INT UNSIGNED     NOT NULL,
    `challenge`       VARBINARY(64)    NOT NULL,   -- 32 bytes random challenge
    `type`            ENUM('registration','authentication') NOT NULL,
    `status`          ENUM('pending','used','expired') NOT NULL DEFAULT 'pending',
    `created_at`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expires_at`      DATETIME         NOT NULL,
    `used_at`         DATETIME         NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_webauthn_challenge_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE,
    INDEX `idx_webauthn_challenge_user_status` (`user_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;