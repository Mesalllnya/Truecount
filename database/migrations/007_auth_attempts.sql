-- Migration: Auth Attempts Table
-- For tracking failed login attempts to enable password fallback after 5 failures

CREATE TABLE IF NOT EXISTS `auth_attempts` (
    `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    `user_id` INT UNSIGNED NULL,
    `identifier` VARCHAR(255) NOT NULL,
    `method` ENUM('webauthn', 'dongle', 'password') NOT NULL,
    `success` TINYINT(1) NOT NULL DEFAULT 0,
    `error` TEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_identifier` (`identifier`),
    INDEX `idx_created_at` (`created_at`),
    
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;